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
  campaign_id?: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaAdsetInsight {
  adset_name: string;
  adset_id?: string;
  campaign_name: string;
  campaign_id?: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaAdCreative {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  effective_status: string;
  thumbnail_url: string | null;
  url_tags: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaCountryInsight {
  country: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaCoreData {
  daily: MetaDailyInsight[];
  campaigns: MetaCampaignInsight[];
  adsets: MetaAdsetInsight[];
  countries: MetaCountryInsight[];
}

export interface MetaCreativesData {
  ads: MetaAdCreative[];
}

export const CAMPAIGN_CATEGORY_MAP: Record<string, string> = {
  'flipper': 'Flipper™ Collection',
  'winch': 'Flipper™ Collection',
  'olli': 'Olli™ Collection',
  'snatch': 'Olli™ Collection',
  'anti-shock': 'Olli™ Collection',
  'anti shock': 'Olli™ Collection',
  'block': 'Olli™ Collection',
  'ring': 'Olli™ Collection',
  'way2': 'Way2',
  'gangway': 'Way2',
  'jib': 'Jib Collection',
  'boat hook': 'Jib Collection',
  'boathook': 'Jib Collection',
  'telescope': 'Jib Collection',
  'pole': 'Jib Collection',
  'brush': 'Jib Collection',
  'linemaster': 'Jib Collection',
  'quickgrip': 'Jib Collection',
  'shackle': 'Textile Connections',
  'dyneema': 'Textile Connections',
  'loop': 'Textile Connections',
  'rope deflector': 'Rope Deflector',
  'brand': 'Brand Awareness',
  'awareness': 'Brand Awareness',
  'retarget': 'Retargeting',
  'remarketing': 'Retargeting',
  'catalog': 'Catalog / DPA',
  'dpa': 'Catalog / DPA',
  'dynamic': 'Catalog / DPA',
};

export function detectCampaignCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, category] of Object.entries(CAMPAIGN_CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Altro';
}

export function getActionValue(actions: { action_type: string; value: string }[] | undefined, type: string): number {
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

// Parse UTM url_tags string (e.g. "utm_source=facebook&utm_campaign=flipper") into object
export function parseUrlTags(urlTags: string): Record<string, string> {
  if (!urlTags) return {};
  const params: Record<string, string> = {};
  try {
    const sp = new URLSearchParams(urlTags);
    for (const [k, v] of sp) {
      if (k.startsWith('utm_')) params[k] = v;
    }
  } catch { /* ignore */ }
  return params;
}

export function useMetaAds(dateRange: { start: Date; end: Date }) {
  return useQuery<MetaCoreData>({
    queryKey: ['meta-ads-core', format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: { dateFrom: format(dateRange.start, 'yyyy-MM-dd'), dateTo: format(dateRange.end, 'yyyy-MM-dd'), mode: 'core' },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as MetaCoreData;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useMetaCreatives(dateRange: { start: Date; end: Date }, enabled: boolean) {
  return useQuery<MetaCreativesData>({
    queryKey: ['meta-ads-creatives', format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: { dateFrom: format(dateRange.start, 'yyyy-MM-dd'), dateTo: format(dateRange.end, 'yyyy-MM-dd'), mode: 'creatives' },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as MetaCreativesData;
    },
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}
