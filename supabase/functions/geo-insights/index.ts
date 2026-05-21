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
    const { countryData, totalNetSales, productByCountry } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Sei un analista strategico esperto di marketing e vendite nel settore nautico per EasySea, brand che vende accessori nautici (copri timoni, copri tientibene, copri winch, lazy bag, lazy jack, borse, cuscini ecc.).

CONTESTO CHIAVE:
- EasySea vende accessori per barche a vela e motore
- La stagione di NAVIGAZIONE varia per paese/zona climatica:
  • Mediterraneo (Italia, Francia, Spagna, Grecia, Croazia, Turchia): Aprile-Ottobre
  • Nord Europa (Germania, Olanda, UK, Scandinavia): Maggio-Settembre  
  • Atlantico (Portogallo, Irlanda): Maggio-Ottobre
  • Tropicale/Subtropicale (Australia, Emirati, ecc.): tutto l'anno o invertito
- L'INDICE DI CONCENTRAZIONE indica se un prodotto è sovra-rappresentato (>1x) o sotto-rappresentato (<1x) in un paese rispetto alla media generale.

FORMATO OUTPUT RICHIESTO — SEGUI ESATTAMENTE QUESTA STRUTTURA:

## 🌍 Overview Macro

Breve paragrafo (3-4 righe max) con i trend generali più importanti che emergono dai dati.

---

Poi, PER OGNI PAESE con vendite significative (almeno i top 8-10), genera UNA SEZIONE DEDICATA con questo formato esatto:

## 🇮🇹 [NOME PAESE] — [% del totale]% del totale

**Stagione navigazione:** [mesi]
**Picco vendite:** [mese/i con vendite più alte]
**Finestra marketing ottimale:** [mesi consigliati per campagne]

### Prodotti chiave
- **[prodotto 1]**: [quantità] pz, indice [X.XX]x — [commento breve]
- **[prodotto 2]**: [quantità] pz, indice [X.XX]x — [commento breve]

### Insight strategico
[2-3 righe con raccomandazione specifica per questo mercato: timing campagne, prodotti da spingere, messaging]

---

Dopo tutte le schede paese, chiudi con:

## 🎯 Raccomandazioni Cross-Market

| Azione | Paesi Target | Timing | Priorità |
|--------|-------------|--------|----------|
| [azione 1] | [paesi] | [quando] | 🔴/🟡/🟢 |
| [azione 2] | [paesi] | [quando] | 🔴/🟡/🟢 |

REGOLE:
- Rispondi SEMPRE in italiano
- Usa le emoji bandiera per ogni paese (🇮🇹🇫🇷🇩🇪🇪🇸🇬🇧🇺🇸🇦🇺🇸🇪🇳🇴🇩🇰🇫🇮🇳🇱🇧🇪🇨🇭🇦🇹🇵🇹🇬🇷🇭🇷 ecc.)
- Ogni sezione paese deve essere chiaramente separata con ---
- NON mischiare i paesi, ogni paese ha la sua sezione dedicata
- Sii specifico con mesi, percentuali e nomi prodotto
- Ordina i paesi dal più grande al più piccolo per vendite`;

    const userMessage = `Ecco i dati di vendita B2C Net Sales per paese (periodo disponibile):

${countryData.map((c: any) => `- ${c.country}: €${c.netSales.toFixed(0)} (${c.orders} ordini, ${c.pct.toFixed(1)}% del totale)`).join('\n')}

Totale Net Sales B2C: €${totalNetSales.toFixed(0)}

DATI MENSILI PER PAESE:
${countryData.filter((c: any) => c.monthly && c.monthly.length > 0).map((c: any) => 
  `${c.country}:\n${c.monthly.map((m: any) => `  ${m.month}: €${m.netSales.toFixed(0)} (${m.orders} ord.)`).join('\n')}`
).join('\n\n')}

PRODOTTI PIÙ VENDUTI PER PAESE (con indice di concentrazione):
${(productByCountry || []).map((c: any) => 
  `${c.country}:\n${(c.topProducts || []).map((p: any) => `  - ${p.product}: ${p.qty} pz, €${p.netSales.toFixed(0)}, indice ${p.indexScore.toFixed(2)}x`).join('\n')}`
).join('\n\n')}

Analizza:
1. La stagionalità di vendita per ogni paese, correlata alla stagione nautica
2. Le PREFERENZE DI PRODOTTO per paese: quali prodotti vendono di più/meno e perché
3. Identifica pattern: certi paesi comprano più cover, altri più accessori? Perché?
4. Raccomandazioni strategiche per marketing, comunicazione e lanci prodotto per ogni mercato chiave`;

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
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, riprova tra poco." }), {
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
    console.error("geo-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
