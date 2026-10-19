// Reads environment variables and reports missing or invalid ones without ever throwing.
import "server-only";

export type EnvReport = {
  aiProvider: string;
  aiModel: string;
  aiMock: boolean;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  googleApiKey: string;
  missing: string[];
  errors: string[];
};

export function getEnv(): EnvReport {
  const aiProvider = process.env.AI_PROVIDER ?? "";
  const aiModel = process.env.AI_MODEL ?? "";
  const aiMock = process.env.AI_MOCK === "true";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";

  const missing: string[] = [];
  const errors: string[] = [];

  if (aiProvider !== "google") {
    errors.push(
      `AI_PROVIDER must be "google" (got "${aiProvider || "unset"}")`
    );
  }

  if (!aiMock && aiProvider === "google" && !googleApiKey) {
    missing.push("GOOGLE_GENERATIVE_AI_API_KEY");
  }

  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  return {
    aiProvider,
    aiModel,
    aiMock,
    supabaseUrl,
    supabaseServiceRoleKey,
    googleApiKey,
    missing,
    errors,
  };
}
