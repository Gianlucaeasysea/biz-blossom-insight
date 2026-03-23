import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchDataContext(supabaseUrl: string, anonKey: string): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateFrom = firstOfMonth.toISOString().slice(0, 10);
  const dateTo = now.toISOString().slice(0, 10);

  let context = "";

  // Fetch B2C orders
  try {
    const b2cResp = await fetch(`${supabaseUrl}/functions/v1/shopify-orders?limit=50&status=any`, { headers });
    if (b2cResp.ok) {
      const b2cData = await b2cResp.json();
      const orders = b2cData.orders || [];
      const filtered = orders.filter((o: any) => {
        const d = new Date(o.date);
        return d >= firstOfMonth && d <= now;
      });

      const total = filtered.reduce((s: number, o: any) => s + (o.netAmount ?? o.totalAmount ?? 0), 0);
      const fulfilled = filtered.filter((o: any) => o.status === "completed");
      const fulfilledTotal = fulfilled.reduce((s: number, o: any) => s + (o.netAmount ?? o.totalAmount ?? 0), 0);

      const skuMap = new Map<string, { qty: number; rev: number }>();
      filtered.forEach((o: any) => (o.products || []).forEach((p: any) => {
        const k = p.sku || p.name || "?";
        const e = skuMap.get(k) || { qty: 0, rev: 0 };
        e.qty += p.quantity || 0;
        e.rev += p.totalPrice || 0;
        skuMap.set(k, e);
      }));
      const topSkus = [...skuMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 20);

      const countryMap = new Map<string, number>();
      filtered.forEach((o: any) => {
        const c = o.country || "Unknown";
        countryMap.set(c, (countryMap.get(c) || 0) + (o.netAmount ?? o.totalAmount ?? 0));
      });

      context += `=== B2C (Shopify) ${dateFrom} → ${dateTo} ===
Ordini: ${filtered.length} | Net Sales: €${total.toFixed(0)} | Evasi: ${fulfilled.length} (€${fulfilledTotal.toFixed(0)})
Top SKU: ${topSkus.map(([k, v]) => `${k}: ${v.qty}pz €${v.rev.toFixed(0)}`).join("; ")}
Paesi: ${[...countryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => `${c}: €${v.toFixed(0)}`).join("; ")}
`;
    }
  } catch (e) {
    console.error("Error fetching B2C:", e);
  }

  // Fetch B2B orders
  try {
    const b2bResp = await fetch(`${supabaseUrl}/functions/v1/google-sheets-orders`, { headers });
    if (b2bResp.ok) {
      const b2bData = await b2bResp.json();
      const orders = b2bData.orders || [];
      const filtered = orders.filter((o: any) => {
        const d = new Date(o.date);
        return d >= firstOfMonth && d <= now;
      });

      const total = filtered.reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);

      const clientMap = new Map<string, { orders: number; rev: number }>();
      filtered.forEach((o: any) => {
        const e = clientMap.get(o.customerName) || { orders: 0, rev: 0 };
        e.orders++;
        e.rev += o.totalAmount ?? 0;
        clientMap.set(o.customerName, e);
      });
      const topClients = [...clientMap.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 10);

      context += `\n=== B2B (Google Sheets) ${dateFrom} → ${dateTo} ===
Ordini: ${filtered.length} | Fatturato: €${total.toFixed(0)}
Top clienti: ${topClients.map(([c, v]) => `${c}: ${v.orders} ordini €${v.rev.toFixed(0)}`).join("; ")}
`;
    }
  } catch (e) {
    console.error("Error fetching B2B:", e);
  }

  return context || "Dati non disponibili al momento.";
}

function cleanForTelegram(text: string): string {
  // Convert markdown to Telegram MarkdownV2 compatible format
  // Actually, let's just clean it up for plain text
  return text
    .replace(/#{1,6}\s*/g, "") // remove heading markers
    .replace(/\*\*(.*?)\*\*/g, "$1") // remove bold markers
    .replace(/\*(.*?)\*/g, "$1") // remove italic markers  
    .replace(/```csv\n[\s\S]*?```/g, "") // remove CSV blocks
    .replace(/```[\s\S]*?```/g, "") // remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links to text
    .replace(/\n{3,}/g, "\n\n") // max 2 newlines
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("telegram-bot: START");

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const FRANK_AI_URL = `${supabaseUrl}/functions/v1/frank-ai`;
    const body = await req.json();
    const { action, chat_id, text } = body;

    console.log("Action:", action, "chat_id:", chat_id, "text:", text?.slice(0, 50));

    if (action === "send") {
      const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "process_message") {
      // Send "typing" indicator
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, action: "typing" }),
      });

      // Fetch REAL data context from APIs
      console.log("Fetching real data context...");
      const dataContext = await fetchDataContext(supabaseUrl, SUPABASE_ANON_KEY);
      console.log("Data context length:", dataContext.length);

      const telegramInstruction = "\n\nIMPORTANTE: Stai rispondendo su Telegram. Formatta la risposta in modo LEGGIBILE per Telegram: usa emoji per i titoli, elenchi con • o numeri, separa le sezioni con righe vuote. NON usare markdown con # o ** o ```. Rispondi in max 3000 caratteri. Sii conciso e diretto.";

      const frankResp = await fetch(FRANK_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text + telegramInstruction }],
          dataContext,
          fileContents: "",
        }),
      });

      console.log("Frank AI status:", frankResp.status);

      if (!frankResp.ok || !frankResp.body) {
        const errText = await frankResp.text();
        console.error("Frank AI error:", errText);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text: "⚠️ Errore nell'elaborazione. Riprova." }),
        });
        return new Response(JSON.stringify({ error: "Frank AI error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read streamed response
      const reader = frankResp.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch { /* skip partial */ }
        }
      }

      // Clean formatting for Telegram
      fullResponse = cleanForTelegram(fullResponse);

      if (fullResponse.length === 0) {
        fullResponse = "Non ho ricevuto dati sufficienti per rispondere. Riprova con una domanda più specifica.";
      }

      if (fullResponse.length > 4000) {
        fullResponse = fullResponse.slice(0, 3997) + "...";
      }

      console.log("Sending response, length:", fullResponse.length);

      const sendResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text: fullResponse }),
      });

      const sendData = await sendResp.json();
      console.log("Telegram send result:", sendData.ok);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-bot FATAL:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
