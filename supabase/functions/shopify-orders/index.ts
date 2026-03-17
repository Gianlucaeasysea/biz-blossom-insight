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
  total_discounts: string;
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
  refunds: Array<{
    refund_line_items?: Array<{
      quantity: number;
      line_item_id: number;
      subtotal: number;
    }>;
  }>;
  shipping_address?: {
    country?: string;
    country_code?: string;
  } | null;
  billing_address?: {
    country?: string;
    country_code?: string;
  } | null;
  landing_site?: string | null;
  referring_site?: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
}

function extractUtmParams(url: string | null | undefined): Record<string, string> {
  if (!url) return {};
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    const utms: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const val = parsed.searchParams.get(key);
      if (val) utms[key] = val;
    }
    return utms;
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!storeName || !accessToken) {
      throw new Error('Missing Shopify credentials. Please configure SHOPIFY_STORE_NAME and SHOPIFY_ACCESS_TOKEN.');
    }

    if (storeName.includes('admin.shopify.com/store/')) {
      const match = storeName.match(/admin\.shopify\.com\/store\/([^\/\?]+)/);
      if (match) storeName = match[1];
    } else if (storeName.includes('.myshopify.com')) {
      storeName = storeName.replace(/https?:\/\//, '').replace('.myshopify.com', '').replace(/\/.*/g, '');
    }
    storeName = storeName.replace(/https?:\/\//g, '').replace(/\//g, '').trim();

    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') || '50';
    const status = url.searchParams.get('status') || 'any';
    const createdAtMin = url.searchParams.get('created_at_min');
    const createdAtMax = url.searchParams.get('created_at_max');

    const baseParams = `limit=${limit}&status=${status}`;
    let shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2024-01/orders.json?${baseParams}`;
    
    if (createdAtMin) shopifyUrl += `&created_at_min=${createdAtMin}`;
    if (createdAtMax) shopifyUrl += `&created_at_max=${createdAtMax}`;

    const allOrders: ShopifyOrder[] = [];
    let nextPageUrl: string | null = shopifyUrl;
    let pageCount = 0;
    const maxPages = 20;

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
              console.log(`Shopify returned ${response.status}, retrying in ${waitMs}ms`);
              await new Promise((r) => setTimeout(r, Math.min(waitMs, 60000)));
              continue;
            }
            throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
          }

          const linkHeader = response.headers.get('Link');
          nextPageUrl = null;
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) nextPageUrl = nextMatch[1];
          }

          const responseText = await response.text();
          data = JSON.parse(responseText);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < maxRetries - 1) {
            const waitMs = Math.pow(2, attempt) * 1000;
            console.log(`Retry ${attempt + 1}/${maxRetries}: ${lastError.message}`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
        }
      }

      if (!data) {
        throw lastError ?? new Error(`Failed to fetch orders page ${pageCount}`);
      }

      const pageOrders = data.orders || [];
      allOrders.push(...pageOrders);

      if (pageOrders.length < parseInt(limit, 10)) nextPageUrl = null;
      if (nextPageUrl) await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`Fetched ${allOrders.length} total orders across ${pageCount} pages`);

    const transformedOrders = allOrders.map((order) => {
      let orderStatus: 'pending' | 'completed' | 'cancelled' | 'refunded' = 'pending';
      if (order.cancelled_at) {
        orderStatus = 'cancelled';
      } else if (order.refunds && order.refunds.length > 0) {
        orderStatus = 'refunded';
      } else if (order.financial_status === 'paid' && order.fulfillment_status === 'fulfilled') {
        orderStatus = 'completed';
      }

      // Calculate net amount (total - discounts - refunds)
      let refundTotal = 0;
      if (order.refunds) {
        for (const refund of order.refunds) {
          if (refund.refund_line_items) {
            for (const rli of refund.refund_line_items) {
              refundTotal += rli.subtotal || 0;
            }
          }
        }
      }
      const netAmount = parseFloat(order.total_price) - refundTotal;

      // Extract UTM parameters from landing_site and referring_site
      const utmFromLanding = extractUtmParams(order.landing_site);
      const utmFromReferring = extractUtmParams(order.referring_site);
      // Also check note_attributes for UTM data
      const utmFromNotes: Record<string, string> = {};
      if (order.note_attributes) {
        for (const attr of order.note_attributes) {
          if (attr.name.startsWith('utm_')) {
            utmFromNotes[attr.name] = attr.value;
          }
        }
      }
      const utm = { ...utmFromReferring, ...utmFromLanding, ...utmFromNotes };

      const country = order.shipping_address?.country || order.billing_address?.country || undefined;
      const destinationCountry = order.shipping_address?.country || undefined;

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
        netAmount,
        currency: order.currency,
        channel: order.source_name,
        status: orderStatus,
        country,
        destinationCountry,
        landingSite: order.landing_site || null,
        referringSite: order.referring_site || null,
        utm: Object.keys(utm).length > 0 ? utm : null,
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
