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
  /** CV parse only. Empty means defaultExtractCv falls back to getModel(). */
  krackeddevsApiKey: string;
  /** OpenAI-compatible base URL. Default is the KrackedDevs LiteLLM endpoint. */
  krackeddevsBaseUrl: string;
  /** Model id for CV parse. Default is a Flash model to spare the sponsor credit. */
  krackeddevsModel: string;
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
  // CV parse only (KrackedDevs / LiteLLM). Optional: when the key is empty,
  // defaultExtractCv uses getModel() (Gemini, RunPod, or Replit Claude).
  // Not added to `missing` — ranking and other chat calls do not need it.
  // Values stay in this object for the server; never log the key or the URL.
  const krackeddevsApiKey = (process.env.KRACKEDDEVS_API_KEY ?? "").trim();
  const krackeddevsBaseUrl =
    (process.env.KRACKEDDEVS_BASE_URL ?? "").trim() || "https://litellm.rapidscreen.io/v1";
  const krackeddevsModel = (process.env.KRACKEDDEVS_MODEL ?? "").trim() || "deepseek-v4.1-flash";

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
    krackeddevsApiKey,
    krackeddevsBaseUrl,
    krackeddevsModel,
    missing,
    errors,
  };
}
