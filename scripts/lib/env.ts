// Tiny .env.local reader for --apply. Deliberately separate from
// src/lib/env.ts (which reads process.env for the Next.js app): this script
// runs outside Next.js and must never print a secret value, only names.
import { existsSync, readFileSync } from "node:fs";
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

export type ReadEnvLocalResult = { exists: boolean; vars: Record<string, string> };

/**
 * Reads <dir>/.env.local. Deliberately does not fall back to process.env:
 * --apply must only ever use secrets from this file, never an ambient
 * shell variable exported for some other project.
 */
export function readEnvLocal(dir: string): ReadEnvLocalResult {
  const path = join(dir, ".env.local");
  if (!existsSync(path)) return { exists: false, vars: {} };
  return { exists: true, vars: parseEnvFile(readFileSync(path, "utf8")) };
}

export const ENV_LOCAL_MISSING_MESSAGE =
  "--apply needs .env.local with SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), " +
  "SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY; see .env.example";

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
