import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface MetaDailyInsight {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
  frequency: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaCampaignInsight {
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaAdsData {
  daily: MetaDailyInsight[];
  campaigns: MetaCampaignInsight[];
}

function getActionValue(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  if (!actions) return 0;
  const action = actions.find(a => a.action_type === type);
  return action ? parseFloat(action.value) : 0;
}

export function parseMetaKPIs(daily: MetaDailyInsight[]) {
  let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalReach = 0, totalPurchases = 0, totalPurchaseValue = 0;

  for (const d of daily) {
    totalSpend += parseFloat(d.spend || '0');
    totalImpressions += parseInt(d.impressions || '0');
    totalClicks += parseInt(d.clicks || '0');
    totalReach += parseInt(d.reach || '0');
    totalPurchases += getActionValue(d.actions, 'purchase');
    totalPurchaseValue += getActionValue(d.action_values, 'purchase');
  }

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const roas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
  const costPerPurchase = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  return { totalSpend, totalImpressions, totalClicks, totalReach, ctr, cpc, cpm, totalPurchases, totalPurchaseValue, roas, costPerPurchase };
}

export { getActionValue };

export function useMetaAds(dateRange: { start: Date; end: Date }) {
  return useQuery<MetaAdsData>({
    queryKey: ['meta-ads', format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: {
          dateFrom: format(dateRange.start, 'yyyy-MM-dd'),
          dateTo: format(dateRange.end, 'yyyy-MM-dd'),
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as MetaAdsData;
    },
    staleTime: 5 * 60 * 1000,
  });
}
