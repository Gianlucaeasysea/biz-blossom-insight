import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_BASE = 'https://graph.facebook.com/v21.0';
const AD_ACCOUNT_ID = 'act_449815118955538';

async function fetchAllPages(url: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = url;
  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Meta API failed [${res.status}]: ${errBody}`);
    }
    const json = await res.json();
    if (json.data) results.push(...json.data);
    nextUrl = json.paging?.next || null;
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('META_ACCESS_TOKEN is not configured');
    }

    const { dateFrom, dateTo } = await req.json();
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });

    // Fetch account-level daily insights
    const insightsUrl = `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,action_values&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=100&access_token=${accessToken}`;

    // Fetch campaign-level data
    const campaignsUrl = `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,action_values&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=100&access_token=${accessToken}`;

    // Fetch ads with creative thumbnails
    const adsUrl = `${META_API_BASE}/${AD_ACCOUNT_ID}/ads?fields=id,name,campaign_id,campaign{name},creative{thumbnail_url,title,body,image_url},effective_status&filtering=[{"field":"impressions","operator":"GREATER_THAN","value":"0"}]&limit=100&access_token=${accessToken}`;

    // Fetch ad-level insights
    const adInsightsUrl = `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=ad_id,ad_name,campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=100&access_token=${accessToken}`;

    const [dailyData, campaignsData, adsData, adInsightsData] = await Promise.all([
      fetchAllPages(insightsUrl),
      fetchAllPages(campaignsUrl),
      fetchAllPages(adsUrl),
      fetchAllPages(adInsightsUrl),
    ]);

    // Merge ad info with insights
    const adInsightsMap = new Map<string, any>();
    for (const ai of adInsightsData) {
      adInsightsMap.set(ai.ad_id, ai);
    }

    const ads = adsData.map((ad: any) => {
      const insights = adInsightsMap.get(ad.id);
      return {
        id: ad.id,
        name: ad.name,
        campaign_id: ad.campaign_id || ad.campaign?.id,
        campaign_name: ad.campaign?.name || insights?.campaign_name || '',
        effective_status: ad.effective_status,
        thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
        creative_title: ad.creative?.title || null,
        creative_body: ad.creative?.body || null,
        spend: insights?.spend || '0',
        impressions: insights?.impressions || '0',
        clicks: insights?.clicks || '0',
        ctr: insights?.ctr || '0',
        cpc: insights?.cpc || '0',
        actions: insights?.actions || [],
        action_values: insights?.action_values || [],
      };
    });

    return new Response(JSON.stringify({
      daily: dailyData,
      campaigns: campaignsData,
      ads,
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
