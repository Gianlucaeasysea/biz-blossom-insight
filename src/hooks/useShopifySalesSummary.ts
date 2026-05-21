import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShopifySalesSummary } from '@/types/analytics';
import { getEdgeAuthHeaders } from '@/lib/edge-auth';


interface ShopifySalesSummaryResponse {
  success: boolean;
  summary?: ShopifySalesSummary;
  error?: string;
}

interface UseShopifySalesSummaryOptions {
  start: Date;
  end: Date;
  enabled?: boolean;
}

export function useShopifySalesSummary({ start, end, enabled = true }: UseShopifySalesSummaryOptions) {
  return useQuery({
    queryKey: ['shopify-sales-summary', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<ShopifySalesSummary> => {
      const params = new URLSearchParams();
      params.set('report_mode', 'summary');
      params.set('created_at_min', format(start, 'yyyy-MM-dd'));
      params.set('created_at_max', format(end, 'yyyy-MM-dd'));

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/shopify-orders?${params.toString()}`, {
        headers: await getEdgeAuthHeaders(),
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data: ShopifySalesSummaryResponse = await response.json();

      if (!data.success || !data.summary) {
        throw new Error(data.error || 'Failed to fetch Shopify sales summary');
      }

      return data.summary;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
    retry: 2,
  });
}
