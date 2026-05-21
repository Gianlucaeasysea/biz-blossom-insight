import { useQuery } from '@tanstack/react-query';
import { Order } from '@/types/analytics';
import { getEdgeAuthHeaders } from '@/lib/edge-auth';


interface GoogleSheetsResponse {
  success: boolean;
  orders: Array<{
    id: string;
    orderNumber: string;
    customerType: 'B2B';
    source: 'google_sheets';
    customerId: string;
    customerName: string;
    date: string;
    deliveryDate: string | null;
    payedDate: string | null;
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
    currency: string;
    channel: string;
    agent?: string;
    status: 'pending' | 'completed' | 'cancelled' | 'refunded';
    orderType?: string;
    country?: string;
  }>;
  count: number;
  error?: string;
}

export function useGoogleSheetsOrders(enabled = true) {
  return useQuery({
    queryKey: ['google-sheets-orders'],
    queryFn: async (): Promise<Order[]> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/google-sheets-orders`,
        {
          headers: await getEdgeAuthHeaders(),
        }
      );


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data: GoogleSheetsResponse = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch Google Sheets orders');
      }

      return data.orders.map((order) => ({
        ...order,
        date: new Date(order.date),
        deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : null,
        payedDate: order.payedDate ? new Date(order.payedDate) : null,
      }));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
    retry: 2,
  });
}
