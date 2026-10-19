import { describe, expect, it } from "vitest";
import { parseEnvFile, requireApplyEnv } from "./env";

describe("parseEnvFile", () => {
  it("parses KEY=value lines", () => {
    expect(parseEnvFile("SUPABASE_URL=https://example.supabase.co\nFOO=bar\n")).toEqual({
      SUPABASE_URL: "https://example.supabase.co",
      FOO: "bar",
    });
  });

  it("skips blank lines and comments", () => {
    expect(parseEnvFile("# comment\n\nKEY=value\n")).toEqual({ KEY: "value" });
  });

  it("strips surrounding quotes", () => {
    expect(parseEnvFile('KEY="quoted value"\n')).toEqual({ KEY: "quoted value" });
  });
});

describe("requireApplyEnv", () => {
  it("resolves when all three variables are present", () => {
    const result = requireApplyEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      GEMINI_API_KEY: "gemini-key",
    });
    expect(result).toEqual({
      ok: true,
      env: {
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceRoleKey: "service-role-key",
        geminiApiKey: "gemini-key",
      },
    });
  });

  it("accepts NEXT_PUBLIC_SUPABASE_URL and GOOGLE_GENERATIVE_AI_API_KEY as aliases", () => {
    const result = requireApplyEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      GOOGLE_GENERATIVE_AI_API_KEY: "gemini-key",
    });
    expect(result.ok).toBe(true);
  });

  it("names only the missing variables, and never a value, when some are absent", () => {
    const result = requireApplyEnv({ SUPABASE_SERVICE_ROLE_KEY: "super-secret-value" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.missing).toEqual([
      "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
      "GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY)",
    ]);
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
  });
});
