// Tiny .env.local reader for --apply. Deliberately separate from
// src/lib/env.ts (which reads process.env for the Next.js app): this script
// runs outside Next.js and must never print a secret value, only names.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Parses .env file syntax: KEY=value, '#' comments, blank lines, optional quotes. */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key.length > 0) result[key] = value;
  }
  return result;
}

/** Reads <dir>/.env.local, or {} when the file does not exist. */
export function readEnvLocal(dir: string): Record<string, string> {
  try {
    return parseEnvFile(readFileSync(join(dir, ".env.local"), "utf8"));
  } catch {
    return {};
  }
}

export type ApplyEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
};

export type RequireApplyEnvResult = { ok: true; env: ApplyEnv } | { ok: false; missing: string[] };

/**
 * Resolves the three secrets --apply needs. Accepts the app's existing
 * GOOGLE_GENERATIVE_AI_API_KEY as an alias for GEMINI_API_KEY, and
 * NEXT_PUBLIC_SUPABASE_URL as an alias for SUPABASE_URL, since both name the
 * same value. Never returns or logs the values themselves on failure.
 */
export function requireApplyEnv(vars: Record<string, string | undefined>): RequireApplyEnvResult {
  const supabaseUrl = vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceRoleKey = vars.SUPABASE_SERVICE_ROLE_KEY || "";
  const geminiApiKey = vars.GEMINI_API_KEY || vars.GOOGLE_GENERATIVE_AI_API_KEY || "";

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!geminiApiKey) missing.push("GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY)");

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, env: { supabaseUrl, supabaseServiceRoleKey, geminiApiKey } };
}
