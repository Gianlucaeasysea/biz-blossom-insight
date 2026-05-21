import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku: string;
  inventory_quantity: number;
  price: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  product_type: string;
  variants: ShopifyVariant[];
  image?: { src: string } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;



  try {
    const shopifyStore = Deno.env.get('SHOPIFY_STORE_NAME');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    if (!shopifyStore || !shopifyToken) {
      throw new Error('Shopify credentials not configured');
    }

    const baseUrl = `https://${shopifyStore}.myshopify.com/admin/api/2024-01`;
    const allProducts: ShopifyProduct[] = [];
    let pageInfo: string | null = null;
    let hasNext = true;

    while (hasNext) {
      let url: string;
      if (pageInfo) {
        url = `${baseUrl}/products.json?limit=250&page_info=${pageInfo}`;
      } else {
        url = `${baseUrl}/products.json?limit=250`;
      }

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Shopify API error ${response.status}: ${body}`);
      }

      const data = await response.json();
      allProducts.push(...(data.products || []));

      // Check for pagination via Link header
      const linkHeader = response.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/);
      if (nextMatch) {
        pageInfo = nextMatch[1];
      } else {
        hasNext = false;
      }
    }

    // Flatten to variant-level rows
    const rows = allProducts.flatMap(product =>
      product.variants.map(variant => ({
        productId: product.id,
        variantId: variant.id,
        productTitle: product.title,
        variantTitle: variant.title === 'Default Title' ? null : variant.title,
        sku: variant.sku || '',
        inventoryQuantity: variant.inventory_quantity,
        price: parseFloat(variant.price) || 0,
        productType: product.product_type || '',
        image: product.image?.src || null,
      }))
    );

    return new Response(JSON.stringify({ success: true, products: rows, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
