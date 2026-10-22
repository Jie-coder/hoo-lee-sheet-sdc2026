// Picks the AI provider (Gemini by default, RunPod optional) and runs the structured "analyze" call, with a mock mode for demos.
import "server-only"; // keep this file out of any client-side bundle
import { generateText, Output, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getEnv } from "./env";
import { AnalysisResultSchema, type AnalysisResult } from "./schema";
import sampleResponse from "@/fixtures/sample-response.json";

// Default model used when AI_MODEL is left empty (current stable Gemini Flash,
// see https://ai.google.dev/gemini-api/docs/models). Update this if a newer
// stable Gemini Flash model is released.
const DEFAULT_GOOGLE_MODEL = "gemini-3.8-flash";

// REPLACE ON HACKATHON DAY: short instructions for the demo AI call.
const SYSTEM_PROMPT =
  "You analyze a short piece of input text and return a structured, neutral assessment. Keep the summary to one or two sentences.";

// How long the mock path waits before responding, so the demo's loading
// state (skeletons) is visible even without a real API call.
const MOCK_DELAY_MS = 800;

const ANTHROPIC_MODEL = "claude-haiku-4-5";

// Logs the selected provider/model once per process (never keys or URLs).
let providerLogged = false;
function logProviderOnce(provider: string, model: string): void {
  if (providerLogged) return;
  providerLogged = true;
  console.info(`[ai] provider=${provider} model=${model}`);
}

// Test-only: lets tests observe the log line again.
export function resetProviderLogForTests(): void {
  providerLogged = false;
}

type GetModelResult =
  | { ok: true; model: LanguageModel }
  | { ok: false; error: string };

// @ai-sdk/anthropic's own default-baseURL handling only special-cases the
// literal "https://api.anthropic.com" (see normalizeBaseURL in its source);
// any other baseURL is used as-is after stripping a trailing slash, with no
// "/v1" appended. Replit's AI Integrations base URL has no "/v1" suffix, so
// this adds it (once) ourselves.
export function resolveAnthropicBaseUrl(base: string): string {
  const stripped = base.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

// Which provider getModel() will actually use, given the current env.
export function getActiveProviderName(): "anthropic" | "google" | "runpod" {
  const env = getEnv();
  if (env.anthropicApiKey && env.anthropicBaseUrl) return "anthropic";
  if (env.aiProvider === "runpod") return "runpod";
  return "google";
}

// Resolves the configured provider and model into a LanguageModel the AI SDK
// can call, or a readable error if the configuration is incomplete/unsupported.
export function getModel(): GetModelResult {
  const env = getEnv();

  // Replit AI Integrations: when both are set, use Claude Haiku regardless
  // of AI_PROVIDER.
  if (env.anthropicApiKey && env.anthropicBaseUrl) {
    const anthropic = createAnthropic({
      apiKey: env.anthropicApiKey,
      baseURL: resolveAnthropicBaseUrl(env.anthropicBaseUrl),
    });
    logProviderOnce("anthropic", ANTHROPIC_MODEL);
    return { ok: true, model: anthropic(ANTHROPIC_MODEL) };
  }

  // Optional: a model we host ourselves on RunPod (vLLM), which speaks the
  // same API format as OpenAI. Only used when AI_PROVIDER=runpod.
  if (env.aiProvider === "runpod") {
    if (!env.runpodBaseUrl || !env.runpodApiKey) {
      return { ok: false, error: "RUNPOD_BASE_URL and RUNPOD_API_KEY must both be set." };
    }
    if (!env.aiModel) {
      return { ok: false, error: "AI_MODEL must be set to the model deployed on RunPod." };
    }
    const runpod = createOpenAICompatible({
      name: "runpod",
      baseURL: env.runpodBaseUrl, // e.g. https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1
      apiKey: env.runpodApiKey,
      supportsStructuredOutputs: true, // vLLM can follow our Zod/JSON schema
    });
    logProviderOnce("runpod", env.aiModel);
    return { ok: true, model: runpod(env.aiModel) };
  }

  // Default: Google Gemini.
  if (env.aiProvider !== "google") {
    return {
      ok: false,
      error: `Unsupported AI_PROVIDER "${env.aiProvider}". Use "google" (default) or "runpod".`,
    };
  }

  if (!env.googleApiKey) {
    return { ok: false, error: "GOOGLE_GENERATIVE_AI_API_KEY is not set." };
  }

  const google = createGoogle({ apiKey: env.googleApiKey });
  const modelId = env.aiModel || DEFAULT_GOOGLE_MODEL;
  logProviderOnce("google", modelId);
  return { ok: true, model: google(modelId) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AnalyzeResult =
  | { ok: true; data: AnalysisResult; source: "mock" | "live" }
  | { ok: false; error: string };

// Runs the AI analysis for a piece of input text. Never throws: callers get a
// typed ok/error result instead of a raw provider exception.
export async function analyze(input: string): Promise<AnalyzeResult> {
  const env = getEnv();

  if (env.aiMock) {
    await delay(MOCK_DELAY_MS);
    const parsed = AnalysisResultSchema.safeParse(sampleResponse);
    if (!parsed.success) {
      return {
        ok: false,
        error: "The mock fixture does not match the AnalysisResult schema.",
      };
    }
    return { ok: true, data: parsed.data, source: "mock" };
  }

  const modelResult = getModel();
  if (!modelResult.ok) {
    return { ok: false, error: modelResult.error };
  }

  try {
    const result = await generateText({
      model: modelResult.model,
      system: SYSTEM_PROMPT,
      prompt: input,
      output: Output.object({ schema: AnalysisResultSchema }),
    });
    return { ok: true, data: result.output, source: "live" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown AI provider error.";
    return { ok: false, error: `AI request failed: ${message}` };
  }
}
