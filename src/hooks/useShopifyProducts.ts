import { useQuery } from '@tanstack/react-query';
import { getEdgeAuthHeaders } from '@/lib/edge-auth';


export interface ShopifyProductRow {
  productId: number;
  variantId: number;
  productTitle: string;
  variantTitle: string | null;
  sku: string;
  inventoryQuantity: number;
  price: number;
  productType: string;
  image: string | null;
}

export function useShopifyProducts(enabled = true) {
  return useQuery({
    queryKey: ['shopify-products'],
    queryFn: async (): Promise<ShopifyProductRow[]> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/shopify-products`, {
        headers: await getEdgeAuthHeaders(),
      });


      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch products');
      return data.products;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
