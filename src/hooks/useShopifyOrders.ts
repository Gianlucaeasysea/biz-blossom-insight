import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types/analytics';

interface ShopifyOrdersResponse {
  success: boolean;
  orders: Array<{
    id: string;
    orderNumber: string;
    customerType: 'B2C';
    source: 'shopify';
    customerId: string;
    customerName: string;
    date: string;
    products: Array<{
      id: string;
      name: string;
      sku: string;
      category: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    totalAmount: number;
    netAmount?: number;
    grossSales?: number;
    totalDiscounts?: number;
    totalRefunds?: number;
    shippingCharges?: number;
    taxes?: number;
    fees?: number;
    totalSales?: number;
    currency: string;
    channel: string;
    status: 'pending' | 'completed' | 'cancelled' | 'refunded';
    country?: string;
    destinationCountry?: string;
    destinationCity?: string;
    destinationProvince?: string;
    landingSite?: string | null;
    referringSite?: string | null;
    utm?: Record<string, string> | null;
  }>;
  count: number;
  error?: string;
}

interface UseShopifyOrdersOptions {
  limit?: number;
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  createdAtMin?: Date;
  createdAtMax?: Date;
  enabled?: boolean;
}

export function useShopifyOrders(options: UseShopifyOrdersOptions = {}) {
  const { limit = 50, status = 'any', createdAtMin, createdAtMax, enabled = true } = options;

  return useQuery({
    queryKey: ['shopify-orders', limit, status, createdAtMin?.toISOString(), createdAtMax?.toISOString()],
    queryFn: async (): Promise<Order[]> => {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('status', status);
      
      if (createdAtMin) {
        params.set('created_at_min', createdAtMin.toISOString());
      }
      if (createdAtMax) {
        params.set('created_at_max', createdAtMax.toISOString());
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/shopify-orders?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data: ShopifyOrdersResponse = await response.json();
      const error = null;

      if (error) {
        console.error('Error fetching Shopify orders:', error);
        throw new Error(error.message || 'Failed to fetch Shopify orders');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch Shopify orders');
      }

      // Transform dates from strings to Date objects
      return data.orders.map((order) => ({
        ...order,
        date: new Date(order.date),
      }));
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
    retry: 2,
  });
}
