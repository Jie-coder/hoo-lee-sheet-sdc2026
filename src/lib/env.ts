// Reads environment variables and reports missing or invalid ones without ever throwing.
import "server-only";

export type EnvReport = {
  aiProvider: string;
  aiModel: string;
  aiMock: boolean;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  googleApiKey: string;
  runpodBaseUrl: string;
  runpodApiKey: string;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  missing: string[];
  errors: string[];
};

export function getEnv(): EnvReport {
  // Gemini ("google") is the default; "runpod" is optional.
  const aiProvider = process.env.AI_PROVIDER || "google";
  const aiModel = process.env.AI_MODEL ?? "";
  const aiMock = process.env.AI_MOCK === "true";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  const runpodBaseUrl = process.env.RUNPOD_BASE_URL ?? "";
  const runpodApiKey = process.env.RUNPOD_API_KEY ?? "";
  // Replit AI Integrations: when both are set, getModel() uses Claude Haiku
  // instead of the default Gemini provider. Optional, so neither is validated below.
  const anthropicApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "";
  const anthropicBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? "";

  const missing: string[] = [];
  const errors: string[] = [];

  if (aiProvider !== "google" && aiProvider !== "runpod") {
    errors.push(`AI_PROVIDER must be "google" or "runpod" (got "${aiProvider}")`);
  }

  if (!aiMock && aiProvider === "google" && !googleApiKey) {
    missing.push("GOOGLE_GENERATIVE_AI_API_KEY");
  }

  // RunPod has no default model, so AI_MODEL is required for it.
  if (!aiMock && aiProvider === "runpod") {
    if (!runpodBaseUrl) missing.push("RUNPOD_BASE_URL");
    if (!runpodApiKey) missing.push("RUNPOD_API_KEY");
    if (!aiModel) missing.push("AI_MODEL");
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
    runpodBaseUrl,
    runpodApiKey,
    anthropicApiKey,
    anthropicBaseUrl,
    missing,
    errors,
  };
}
