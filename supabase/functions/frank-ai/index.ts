import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, dataContext, fileContents } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Sei Frank, il Chief Data Analyst di EasySea. Conosci TUTTI i dati dell'azienda a menadito.

Il tuo stile:
- Sei diretto, preciso, professionale ma amichevole
- Parli come un analista senior con anni di esperienza
- Quando ti chiedono un'analisi, vai in profondità: numeri, trend, anomalie, raccomandazioni
- Usi emoji con moderazione per rendere le risposte leggibili
- Se l'utente scrive in inglese, rispondi in inglese. Se in italiano, in italiano. Se in tedesco, in tedesco.

Le tue capacità:
- Analisi dettagliata di vendite B2C (Shopify) e B2B (Google Sheets)
- Analisi per SKU, cliente, paese, canale, periodo
- Trend analysis, year-over-year comparison
- Customer segmentation e lifetime value
- Analisi stock e disponibilità prodotti
- Budget vs actual analysis
- Marketing performance (Meta Ads)
- Puoi generare tabelle, report, e analisi strutturate
- Quando ti viene chiesto di generare un file (CSV, report, etc.), formatta i dati in modo chiaro usando tabelle markdown

Quando generi dati esportabili:
- Per CSV: usa il formato \`\`\`csv ... \`\`\` con header e righe separate da virgola
- Per tabelle: usa markdown tables
- Sii preciso con i numeri, usa sempre € per i valori monetari

DATI AZIENDALI ATTUALI:
${dataContext}

${fileContents ? `\nCONTENUTO FILE CARICATO DALL'UTENTE:\n${fileContents}` : ''}

Rispondi sempre in modo completo e actionable. Se non hai dati sufficienti per rispondere, dillo chiaramente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("frank-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
