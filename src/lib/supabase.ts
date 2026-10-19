// Server-only Supabase client, built from env vars. Never throws at import/build time.
import "server-only"; // keep this file out of any client-side bundle
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

export type GetSupabaseResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string };

// Returns a configured Supabase client, or a readable error if SUPABASE_URL
// / SUPABASE_SERVICE_ROLE_KEY are missing. Called lazily (per request) so a
// missing config never crashes the build or app startup.
export function getSupabase(): GetSupabaseResult {
  const env = getEnv();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      ok: false,
      error: "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
  return { ok: true, client };
}
