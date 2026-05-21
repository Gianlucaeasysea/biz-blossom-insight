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
    const { customer } = await req.json();
    if (!customer?.products || !Array.isArray(customer.products)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const productList = customer.products
      .slice(0, 100)
      .map((p: any) => `- ${p.name} (qty ${p.quantity}, €${p.totalPrice?.toFixed?.(0) ?? '?'})`)
      .join('\n');

    const systemPrompt = `Sei un analista marketing per Easysea, brand di accessori nautici (yacht, gommoni, barche a vela, day cruiser).
Analizza lo storico acquisti di un cliente e inferisci:
1) tipologia di barca probabile (gommone, cabinato, yacht, vela, day-cruiser, sconosciuto)
2) range di lunghezza barca (<6m, 6-10m, 10-15m, 15-25m, >25m, n/d)
3) profilo del proprietario in 1 riga (es. "Diportista weekend, barca media, area Mediterraneo")
4) 3-5 suggerimenti di cross-sell concreti dal catalogo Easysea con motivazione e sconto consigliato.
Rispondi SOLO via tool call.`;

    const userPrompt = `Cliente: ${customer.name || 'N/D'}
Paese: ${customer.country || 'N/D'}
N° ordini: ${customer.orders}
LTV: €${Math.round(customer.totalSpent || 0)}
Prodotti acquistati:
${productList}`;

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
            name: 'submit_insight',
            description: 'Restituisce il profilo barca e i suggerimenti cross-sell',
            parameters: {
              type: 'object',
              properties: {
                boatType: { type: 'string', enum: ['gommone', 'cabinato', 'yacht', 'vela', 'day-cruiser', 'sconosciuto'] },
                boatSizeRange: { type: 'string', enum: ['<6m', '6-10m', '10-15m', '15-25m', '>25m', 'n/d'] },
                ownerProfile: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                crossSellSuggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      product: { type: 'string' },
                      reason: { type: 'string' },
                      suggestedDiscountPct: { type: 'number' },
                    },
                    required: ['product', 'reason', 'suggestedDiscountPct'],
                  },
                },
              },
              required: ['boatType', 'boatSizeRange', 'ownerProfile', 'confidence', 'crossSellSuggestions'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'submit_insight' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit superato, riprova fra poco.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Crediti AI esauriti, aggiungi fondi nelle impostazioni.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${t}`);
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error('Risposta AI senza tool call');
    const insight = JSON.parse(args);

    return new Response(JSON.stringify({ success: true, insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('b2c-customer-insight error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
