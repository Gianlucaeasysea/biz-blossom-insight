import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;



  try {
    const { messages, dashboardContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Sei un marketer professionista e analista di dati esperto per EasySea, un'azienda che vende prodotti sia B2C (Shopify) che B2B (Google Sheets).

Il tuo ruolo è:
- Rispondere con precisione a domande sui dati della dashboard
- Fornire insight strategici e raccomandazioni da marketer esperto
- Analizzare trend, performance per SKU, per paese, per canale, per segmento RFM
- Suggerire strategie di crescita, retention, acquisizione e upselling basate sui dati
- Identificare opportunità di ottimizzazione del customer lifetime value (LTV)
- Analizzare i canali di acquisizione e suggerire come ottimizzare il budget marketing
- Parlare in italiano o inglese a seconda della lingua usata dall'utente

DATI ATTUALI DELLA DASHBOARD:
${dashboardContext}

Quando rispondi:
- Usa numeri precisi dai dati forniti
- Formatta i valori monetari in EUR (€)
- Evidenzia trend importanti e anomalie
- Fornisci consigli strategici actionable da marketer esperto
- Ragiona in termini di funnel, cohort, segmentazione e ROI
- Sii conciso ma completo
- Usa emoji per rendere le risposte più leggibili
- Se l'utente scrive in inglese, rispondi in inglese`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi messaggi, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
