import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("telegram-poll: START");

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not found");
      return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Token found, length:", TELEGRAM_BOT_TOKEN.length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

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
    console.log("Current offset:", currentOffset);

    // Quick poll (timeout: 0 = no long polling)
    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
    console.log("Fetching updates...");
    
    const response = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset: currentOffset,
        timeout: 0,
        allowed_updates: ["message"],
      }),
    });

    const data = await response.json();
    console.log("Telegram response ok:", response.ok, "updates:", data.result?.length ?? 0);

    if (!response.ok) {
      console.error("Telegram API error:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates = data.result ?? [];

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
      await supabase.from("telegram_messages").upsert(rows, { onConflict: "update_id" });
    }

    // Process each message through Frank AI
    const FRANK_BOT_URL = `${supabaseUrl}/functions/v1/telegram-bot`;
    for (const update of updates) {
      if (update.message?.text) {
        console.log("Processing:", update.message.text.slice(0, 50));
        try {
          await fetch(FRANK_BOT_URL, {
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
        } catch (e) {
          console.error("Frank processing error:", e);
        }
      }
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    console.log("Done. Processed:", updates.length, "New offset:", newOffset);

    return new Response(JSON.stringify({ ok: true, processed: updates.length, newOffset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-poll FATAL:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
