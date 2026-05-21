import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Verify the request carries a valid Supabase user JWT.
 * Returns the user on success, or a Response (401) on failure.
 *
 * Usage:
 *   const auth = await requireAuth(req, corsHeaders);
 *   if (auth instanceof Response) return auth;
 *   const user = auth;
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ id: string; email?: string } | Response> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const token = authHeader.slice(7).trim();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
