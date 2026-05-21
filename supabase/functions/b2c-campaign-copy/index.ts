import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;



  try {
    const { segment, customerCount, topProducts, avgLTV } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `Sei un copywriter senior per Easysea (accessori nautici premium).
Generi copy in italiano per campagne email + Meta Ads mirate a un segmento specifico.
Tono: confidente, marinaresco ma professionale, valore prima del prezzo.
Restituisci SOLO via tool call con: subject email, body email markdown completa, primary text Meta Ads (max 125 parole), headline Meta Ads (max 40 char).`;

    const userPrompt = `Segmento: ${segment.boatType || 'misto'} ${segment.boatSizeRange || ''}
Profilo: ${segment.ownerProfile || 'diportista'}
Clienti nel segmento: ${customerCount}
LTV medio: €${Math.round(avgLTV || 0)}
Top prodotti già acquistati: ${(topProducts || []).slice(0, 5).join(', ')}
Suggerimenti cross-sell ricorrenti: ${(segment.crossSellSuggestions || []).slice(0, 3).map((s: any) => s.product).join(', ')}

Crea una campagna che proponga prodotti complementari con un'offerta dedicata al segmento.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'submit_campaign',
            parameters: {
              type: 'object',
              properties: {
                emailSubject: { type: 'string' },
                emailBody: { type: 'string', description: 'Markdown' },
                metaPrimaryText: { type: 'string' },
                metaHeadline: { type: 'string' },
                suggestedDiscount: { type: 'string' },
              },
              required: ['emailSubject', 'emailBody', 'metaPrimaryText', 'metaHeadline'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'submit_campaign' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit superato, riprova fra poco.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Crediti AI esauriti.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${t}`);
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error('Risposta AI senza tool call');
    const campaign = JSON.parse(args);

    return new Response(JSON.stringify({ success: true, campaign }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('b2c-campaign-copy error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
