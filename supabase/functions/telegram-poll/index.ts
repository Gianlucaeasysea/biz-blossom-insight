import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const FRANK_BOT_URL = `${supabaseUrl}/functions/v1/telegram-bot`;

    // Read current offset
    const { data: state, error: stateErr } = await supabase
      .from("telegram_bot_state")
      .select("update_offset")
      .eq("id", 1)
      .single();

    if (stateErr) {
      console.error("State read error:", stateErr.message);
      return new Response(JSON.stringify({ error: stateErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentOffset = state.update_offset;
    console.log("Polling with offset:", currentOffset);

    // Quick poll (no long polling - just check for new messages)
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: currentOffset,
          timeout: 0,
          allowed_updates: ["message"],
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Telegram API error:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates = data.result ?? [];
    console.log("Got updates:", updates.length);

    if (updates.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store messages
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? null,
        raw_update: u,
      }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from("telegram_messages")
        .upsert(rows, { onConflict: "update_id" });

      if (insertErr) {
        console.error("Insert error:", insertErr.message);
      }
    }

    // Process each message through Frank AI
    for (const update of updates) {
      if (update.message?.text) {
        console.log("Processing message from chat:", update.message.chat.id, "text:", update.message.text);
        try {
          const botResp = await fetch(FRANK_BOT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              action: "process_message",
              chat_id: update.message.chat.id,
              text: update.message.text,
            }),
          });
          const botData = await botResp.json();
          console.log("Frank response status:", botResp.status, JSON.stringify(botData).slice(0, 200));
        } catch (e) {
          console.error("Error processing message:", e);
        }
      }
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({ ok: true, processed: updates.length, newOffset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-poll error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
