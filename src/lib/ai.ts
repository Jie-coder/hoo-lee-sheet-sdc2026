// Picks the AI provider/model and runs the structured "analyze" call, with a mock mode for demos.
import "server-only"; // keep this file out of any client-side bundle
import { generateText, Output, type LanguageModel } from "ai";
import { createGoogle } from "@ai-sdk/google";
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

type GetModelResult =
  | { ok: true; model: LanguageModel }
  | { ok: false; error: string };

// Resolves the configured provider and model into a LanguageModel the AI SDK
// can call, or a readable error if the configuration is incomplete/unsupported.
export function getModel(): GetModelResult {
  const env = getEnv();

  if (env.aiProvider !== "google") {
    return {
      ok: false,
      error: `Unsupported AI_PROVIDER "${env.aiProvider || "unset"}". This starter only supports "google".`,
    };
  }

  if (!env.googleApiKey) {
    return { ok: false, error: "GOOGLE_GENERATIVE_AI_API_KEY is not set." };
  }

  const google = createGoogle({ apiKey: env.googleApiKey });
  const modelId = env.aiModel || DEFAULT_GOOGLE_MODEL;
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
