import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("telegram-bot: START");

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not found");
      return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!SUPABASE_ANON_KEY) {
      console.error("SUPABASE_ANON_KEY not found");
      return new Response(JSON.stringify({ error: "SUPABASE_ANON_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FRANK_AI_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/frank-ai";
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
      console.log("Send result:", data.ok);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "process_message") {
      console.log("Calling Frank AI...");
      
      // Send "typing" indicator
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, action: "typing" }),
      });

      const frankResp = await fetch(FRANK_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          dataContext: "Rispondi in modo conciso, adatto a Telegram (max 4000 caratteri). Usa formato testo semplice, non markdown complesso. Non usare tag HTML.",
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

      console.log("Frank response length:", fullResponse.length);

      if (fullResponse.length === 0) {
        fullResponse = "Non ho ricevuto dati sufficienti per rispondere. Riprova con una domanda più specifica.";
      }

      // Truncate if needed
      if (fullResponse.length > 4000) {
        fullResponse = fullResponse.slice(0, 3997) + "...";
      }

      // Send response to Telegram (plain text, no parse_mode to avoid HTML issues)
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
