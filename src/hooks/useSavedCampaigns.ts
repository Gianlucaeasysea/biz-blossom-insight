import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SavedCampaign {
  id: string;
  name: string;
  objective: string;
  segment: string | null;
  boat_type: string | null;
  product_names: string[];
  audience_ids: string[];
  audience_size: number;
  discount_pct: number;
  est_revenue_min: number;
  est_revenue_max: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useSavedCampaigns() {
  return useQuery({
    queryKey: ['b2c-marketing-campaigns'],
    queryFn: async (): Promise<SavedCampaign[]> => {
      const { data, error } = await supabase
        .from('b2c_marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedCampaign[];
    },
  });
}

export function useSaveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<SavedCampaign, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('b2c_marketing_campaigns')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b2c-marketing-campaigns'] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('b2c_marketing_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b2c-marketing-campaigns'] }),
  });
}
