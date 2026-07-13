import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_BASE = 'https://graph.facebook.com/v21.0';
const AD_ACCOUNT_ID = Deno.env.get('META_AD_ACCOUNT_ID') ?? 'act_449815118955538';

// Fetch ALL pages from a Meta Graph paginated endpoint.
// Meta insights truncate at `limit` per page — without paging we drop data
// (e.g. account-level daily insights beyond ~100 days, or large adset counts).
async function fetchAllPages(url: string, label: string, maxPages = 40): Promise<any[]> {
  const results: any[] = [];
  let next: string | null = url;
  let page = 0;
  while (next && page < maxPages) {
    const res = await fetch(next);
    if (!res.ok) throw new Error(`Meta ${label} failed [${res.status}] page ${page + 1}: ${await res.text()}`);
    const json = await res.json();
    if (Array.isArray(json.data)) results.push(...json.data);
    next = json.paging?.next ?? null;
    page += 1;
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('META_ACCESS_TOKEN is not configured');
    }

    const { dateFrom, dateTo, mode } = await req.json();
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });
    const tr = encodeURIComponent(timeRange);

    if (mode === 'creatives') {
      const [ads, adInsights] = await Promise.all([
        fetchAllPages(
          `${META_API_BASE}/${AD_ACCOUNT_ID}/ads?fields=id,name,campaign_id,campaign{name},adset_id,adset{name},creative{thumbnail_url,image_url,url_tags},effective_status&filtering=[{"field":"impressions","operator":"GREATER_THAN","value":"0"}]&limit=100&access_token=${accessToken}`,
          'ads',
        ),
        fetchAllPages(
          `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=ad_id,ad_name,campaign_name,campaign_id,adset_name,adset_id,spend,impressions,clicks,ctr,cpc,actions,action_values&time_range=${tr}&level=ad&limit=200&access_token=${accessToken}`,
          'ad-insights',
        ),
      ]);

      const insightsMap = new Map<string, any>();
      for (const ai of adInsights) insightsMap.set(ai.ad_id, ai);

      const result = ads.map((ad: any) => {
        const insights = insightsMap.get(ad.id);
        return {
          id: ad.id,
          name: ad.name,
          campaign_id: ad.campaign_id || ad.campaign?.id,
          campaign_name: ad.campaign?.name || insights?.campaign_name || '',
          adset_id: ad.adset_id || ad.adset?.id || insights?.adset_id || '',
          adset_name: ad.adset?.name || insights?.adset_name || '',
          effective_status: ad.effective_status,
          thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
          url_tags: ad.creative?.url_tags || '',
          spend: insights?.spend || '0',
          impressions: insights?.impressions || '0',
          clicks: insights?.clicks || '0',
          ctr: insights?.ctr || '0',
          cpc: insights?.cpc || '0',
          actions: insights?.actions || [],
          action_values: insights?.action_values || [],
        };
      });

      return new Response(JSON.stringify({ ads: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DEFAULT: core data — daily + campaigns + adsets + country + monthly campaigns.
    // All endpoints paginated to avoid truncation over long ranges / large accounts.
    const [daily, campaigns, adsets, countries, campaignMonthly] = await Promise.all([
      fetchAllPages(
        `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,action_values&time_range=${tr}&time_increment=1&limit=500&access_token=${accessToken}`,
        'daily-insights',
      ),
      fetchAllPages(
        `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=campaign_name,campaign_id,objective,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,action_values&time_range=${tr}&level=campaign&limit=200&access_token=${accessToken}`,
        'campaign-insights',
      ),
      fetchAllPages(
        `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=adset_name,adset_id,campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,action_values&time_range=${tr}&level=adset&limit=200&access_token=${accessToken}`,
        'adset-insights',
      ),
      fetchAllPages(
        `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,action_values&time_range=${tr}&breakdowns=country&limit=200&access_token=${accessToken}`,
        'country-insights',
      ),
      fetchAllPages(
        `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=campaign_name,campaign_id,objective,spend,impressions&time_range=${tr}&level=campaign&time_increment=monthly&limit=500&access_token=${accessToken}`,
        'campaign-monthly-insights',
      ),
    ]);

    return new Response(JSON.stringify({
      daily,
      campaigns,
      adsets,
      countries,
      campaignMonthly,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Meta Ads error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
