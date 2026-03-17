import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_BASE = 'https://graph.facebook.com/v21.0';
const AD_ACCOUNT_ID = 'act_449815118955538';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('META_ACCESS_TOKEN is not configured');
    }

    const { dateFrom, dateTo, mode } = await req.json();
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });

    // MODE: 'core' (default) = daily + campaigns only, 'creatives' = ads with thumbnails
    if (mode === 'creatives') {
      // Fetch ads with creative thumbnails + ad-level insights
      const [adsRes, adInsightsRes] = await Promise.all([
        fetch(`${META_API_BASE}/${AD_ACCOUNT_ID}/ads?fields=id,name,campaign_id,campaign{name},creative{thumbnail_url,image_url},effective_status&filtering=[{"field":"impressions","operator":"GREATER_THAN","value":"0"}]&limit=50&access_token=${accessToken}`),
        fetch(`${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=ad_id,ad_name,campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=50&access_token=${accessToken}`),
      ]);

      if (!adsRes.ok) throw new Error(`Meta ads failed [${adsRes.status}]: ${await adsRes.text()}`);
      if (!adInsightsRes.ok) throw new Error(`Meta ad insights failed [${adInsightsRes.status}]: ${await adInsightsRes.text()}`);

      const adsData = await adsRes.json();
      const adInsightsData = await adInsightsRes.json();

      const insightsMap = new Map<string, any>();
      for (const ai of (adInsightsData.data || [])) {
        insightsMap.set(ai.ad_id, ai);
      }

      const ads = (adsData.data || []).map((ad: any) => {
        const insights = insightsMap.get(ad.id);
        return {
          id: ad.id,
          name: ad.name,
          campaign_id: ad.campaign_id || ad.campaign?.id,
          campaign_name: ad.campaign?.name || insights?.campaign_name || '',
          effective_status: ad.effective_status,
          thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
          spend: insights?.spend || '0',
          impressions: insights?.impressions || '0',
          clicks: insights?.clicks || '0',
          ctr: insights?.ctr || '0',
          cpc: insights?.cpc || '0',
          actions: insights?.actions || [],
          action_values: insights?.action_values || [],
        };
      });

      return new Response(JSON.stringify({ ads }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DEFAULT: core data - daily insights + campaign breakdown
    const [insightsRes, campaignsRes] = await Promise.all([
      fetch(`${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,action_values&time_range=${encodeURIComponent(timeRange)}&time_increment=1&limit=100&access_token=${accessToken}`),
      fetch(`${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,action_values&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=100&access_token=${accessToken}`),
    ]);

    if (!insightsRes.ok) throw new Error(`Meta insights failed [${insightsRes.status}]: ${await insightsRes.text()}`);
    if (!campaignsRes.ok) throw new Error(`Meta campaigns failed [${campaignsRes.status}]: ${await campaignsRes.text()}`);

    const insightsData = await insightsRes.json();
    const campaignsData = await campaignsRes.json();

    return new Response(JSON.stringify({
      daily: insightsData.data || [],
      campaigns: campaignsData.data || [],
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
