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

    const { dateFrom, dateTo } = await req.json();
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });

    // Fetch account-level insights
    const insightsUrl = `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,action_values&time_range=${encodeURIComponent(timeRange)}&time_increment=1&access_token=${accessToken}`;
    
    const insightsRes = await fetch(insightsUrl);
    if (!insightsRes.ok) {
      const errBody = await insightsRes.text();
      throw new Error(`Meta API insights failed [${insightsRes.status}]: ${errBody}`);
    }
    const insightsData = await insightsRes.json();

    // Fetch campaign-level data
    const campaignsUrl = `${META_API_BASE}/${AD_ACCOUNT_ID}/insights?fields=campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,action_values&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=50&access_token=${accessToken}`;

    const campaignsRes = await fetch(campaignsUrl);
    if (!campaignsRes.ok) {
      const errBody = await campaignsRes.text();
      throw new Error(`Meta API campaigns failed [${campaignsRes.status}]: ${errBody}`);
    }
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
