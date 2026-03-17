import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    sku: string;
    quantity: number;
    price: string;
    product_id: number;
  }>;
  source_name: string;
  cancelled_at: string | null;
  refunds: Array<unknown>;
  shipping_address?: {
    country?: string;
    country_code?: string;
  } | null;
  billing_address?: {
    country?: string;
    country_code?: string;
  } | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!storeName || !accessToken) {
      throw new Error('Missing Shopify credentials. Please configure SHOPIFY_STORE_NAME and SHOPIFY_ACCESS_TOKEN.');
    }

    // Clean up store name - extract just the store name from various formats
    // Handle: "https://admin.shopify.com/store/mystore", "mystore.myshopify.com", "mystore"
    if (storeName.includes('admin.shopify.com/store/')) {
      const match = storeName.match(/admin\.shopify\.com\/store\/([^\/\?]+)/);
      if (match) storeName = match[1];
    } else if (storeName.includes('.myshopify.com')) {
      storeName = storeName.replace(/https?:\/\//, '').replace('.myshopify.com', '').replace(/\/.*/g, '');
    }
    // Remove any remaining protocol or trailing slashes
    storeName = storeName.replace(/https?:\/\//g, '').replace(/\//g, '').trim();

    // Parse query parameters
    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') || '50';
    const status = url.searchParams.get('status') || 'any';
    const createdAtMin = url.searchParams.get('created_at_min');
    const createdAtMax = url.searchParams.get('created_at_max');

    // Build base Shopify API URL
    const baseParams = `limit=${limit}&status=${status}`;
    let shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2024-01/orders.json?${baseParams}`;
    
    if (createdAtMin) {
      shopifyUrl += `&created_at_min=${createdAtMin}`;
    }
    if (createdAtMax) {
      shopifyUrl += `&created_at_max=${createdAtMax}`;
    }

    // Paginate through all orders using cursor-based pagination
    const allOrders: ShopifyOrder[] = [];
    let nextPageUrl: string | null = shopifyUrl;
    let pageCount = 0;
    const maxPages = 20; // Safety limit: 20 pages × 250 = up to 5000 orders

    while (nextPageUrl && pageCount < maxPages) {
      pageCount++;
      console.log(`Fetching orders page ${pageCount}: ${nextPageUrl}`);

      let data: { orders?: ShopifyOrder[] } | null = null;
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(nextPageUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error body');

            if ((response.status === 429 || response.status >= 500) && attempt < maxRetries - 1) {
              const retryAfter = response.headers.get('Retry-After');
              const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
              console.log(`Shopify returned ${response.status}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise((r) => setTimeout(r, Math.min(waitMs, 60000)));
              continue;
            }

            throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
          }

          // Parse next page URL from Link header before reading body
          const linkHeader = response.headers.get('Link');
          nextPageUrl = null;
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) {
              nextPageUrl = nextMatch[1];
            }
          }

          const responseText = await response.text();
          data = JSON.parse(responseText);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries - 1) {
            const waitMs = Math.pow(2, attempt) * 1000;
            console.log(`Shopify request failed on attempt ${attempt + 1}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs}ms...`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
        }
      }

      if (!data) {
        throw lastError ?? new Error(`Failed to fetch orders page ${pageCount} after ${maxRetries} attempts.`);
      }

      const pageOrders = data.orders || [];
      allOrders.push(...pageOrders);

      // If we got fewer orders than the limit, there are no more pages
      if (pageOrders.length < parseInt(limit, 10)) {
        nextPageUrl = null;
      }

      // Small delay between pages to respect rate limits
      if (nextPageUrl) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`Fetched ${allOrders.length} total orders across ${pageCount} pages`);
    const orders = allOrders;

    // Transform Shopify orders to our unified format
    const transformedOrders = orders.map((order) => {
      // Map status
      let status: 'pending' | 'completed' | 'cancelled' | 'refunded' = 'pending';
      if (order.cancelled_at) {
        status = 'cancelled';
      } else if (order.refunds && order.refunds.length > 0) {
        status = 'refunded';
      } else if (order.financial_status === 'paid' && order.fulfillment_status === 'fulfilled') {
        status = 'completed';
      }

      const country = order.shipping_address?.country || order.billing_address?.country || undefined;

      return {
        id: `shopify-${order.id}`,
        orderNumber: order.name,
        customerType: 'B2C' as const,
        source: 'shopify' as const,
        customerId: order.customer ? `shopify-customer-${order.customer.id}` : 'guest',
        customerName: order.customer 
          ? `${order.customer.first_name} ${order.customer.last_name}`.trim() 
          : 'Ospite',
        date: order.created_at,
        products: order.line_items.map((item) => ({
          id: `shopify-item-${item.id}`,
          name: item.title,
          sku: item.sku || `SKU-${item.product_id}`,
          category: 'Shopify',
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          totalPrice: parseFloat(item.price) * item.quantity,
        })),
        totalAmount: parseFloat(order.total_price),
        currency: order.currency,
        channel: order.source_name,
        status,
        country,
      };
    });

    console.log(`Successfully fetched ${transformedOrders.length} orders from Shopify`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        orders: transformedOrders,
        count: transformedOrders.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
