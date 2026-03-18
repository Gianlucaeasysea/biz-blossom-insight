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
  subtotal_price: string;
  total_discounts: string;
  total_tax?: string;
  current_total_tax?: string;
  total_shipping_price_set?: {
    shop_money?: { amount: string };
  };
  current_total_additional_fees_set?: {
    shop_money?: { amount: string };
  };
  currency: string;
...
      const country = order.shipping_address?.country || order.billing_address?.country || undefined;
      const destinationCountry = order.shipping_address?.country || undefined;
      const shippingCharges = parseFloat(order.total_shipping_price_set?.shop_money?.amount || '0');
      const taxes = parseFloat(order.current_total_tax || order.total_tax || '0');
      const fees = parseFloat(order.current_total_additional_fees_set?.shop_money?.amount || '0');
      const totalSales = netAmount + shippingCharges + taxes + fees;

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
        products: order.line_items.map((item) => {
          const grossPrice = parseFloat(item.price) * item.quantity;
          // Subtract line-item discount allocations
          const itemDiscount = (item.discount_allocations || []).reduce(
            (s, d) => s + parseFloat(d.amount || '0'), 0
          );
          // Subtract refunds for this line item
          let itemRefund = 0;
          if (order.refunds) {
            for (const refund of order.refunds) {
              for (const rli of (refund.refund_line_items || [])) {
                if (rli.line_item_id === item.id) {
                  itemRefund += rli.subtotal || 0;
                }
              }
            }
          }
          const netPrice = grossPrice - itemDiscount - itemRefund;
          return {
            id: `shopify-item-${item.id}`,
            name: item.title,
            sku: item.sku || `SKU-${item.product_id}`,
            category: 'Shopify',
            quantity: item.quantity,
            unitPrice: parseFloat(item.price),
            totalPrice: Math.round(netPrice * 100) / 100,
          };
        }),
        totalAmount: parseFloat(order.total_price),
        netAmount,
        grossSales,
        totalDiscounts,
        totalRefunds: refundTotal,
        shippingCharges,
        taxes,
        fees,
        totalSales,
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
