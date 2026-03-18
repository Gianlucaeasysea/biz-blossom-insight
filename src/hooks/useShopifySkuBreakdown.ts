import { useQuery } from '@tanstack/react-query';

export interface ShopifySkuRow {
  sku: string;
  name: string;
  netQuantity: number;
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
}

interface UseShopifySkuBreakdownOptions {
  start: Date;
  end: Date;
  enabled?: boolean;
}

export function useShopifySkuBreakdown({ start, end, enabled = true }: UseShopifySkuBreakdownOptions) {
  return useQuery({
    queryKey: ['shopify-sku-breakdown', start.toISOString().split('T')[0], end.toISOString().split('T')[0]],
    queryFn: async (): Promise<ShopifySkuRow[]> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const params = new URLSearchParams({
        report_mode: 'sku_breakdown',
        created_at_min: start.toISOString().split('T')[0],
        created_at_max: end.toISOString().split('T')[0],
      });

      const response = await fetch(
        `${supabaseUrl}/functions/v1/shopify-orders?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch SKU breakdown');
      }

      return (data.skuBreakdown || []).map((row: Record<string, unknown>) => ({
        sku: row.sku as string,
        name: row.variantTitle && row.variantTitle !== 'Default Title'
          ? `${row.productTitle} - ${row.variantTitle}`
          : row.productTitle as string,
        netQuantity: row.netQuantity as number,
        grossSales: row.grossSales as number,
        discounts: row.discounts as number,
        returns: row.returns as number,
        netSales: row.netSales as number,
      }));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
