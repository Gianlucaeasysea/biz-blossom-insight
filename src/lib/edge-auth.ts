import { supabase } from "@/integrations/supabase/client";

/**
 * Build auth headers for calling edge functions.
 * Uses the current user's session JWT (required for functions that enforce auth)
 * and includes the anon publishable key as the `apikey` header.
 */
export async function getEdgeAuthHeaders(): Promise<Record<string, string>> {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? anonKey;
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
  };
}
