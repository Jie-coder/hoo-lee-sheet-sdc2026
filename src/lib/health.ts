// Runs the integration health checks shared by /api/health and the /status page.
import "server-only";
import { generateText } from "ai";
import { getEnv } from "./env";
import { getSupabase } from "./supabase";
import { getActiveProviderName, getModel } from "./ai";

export type CheckResult = {
  name: string;
  ok: boolean;
  message: string;
};

function checkEnv(): CheckResult {
  const env = getEnv();
  const problems = [
    ...env.errors,
    ...env.missing.map((name) => `${name} is not set`),
  ];

  if (problems.length > 0) {
    return { name: "Environment variables", ok: false, message: problems.join("; ") };
  }
  return {
    name: "Environment variables",
    ok: true,
    message: "All required variables are set.",
  };
}

async function checkSupabase(): Promise<CheckResult> {
  const supabase = getSupabase();
  if (!supabase.ok) {
    return { name: "Supabase", ok: false, message: supabase.error };
  }

  const { error } = await supabase.client.from("items").select("id").limit(1);
  if (error) {
    return { name: "Supabase", ok: false, message: `Supabase error: ${error.message}` };
  }
  return {
    name: "Supabase",
    ok: true,
    message: "Connected and able to query the items table.",
  };
}

async function checkAiProvider(deep: boolean): Promise<CheckResult> {
  const env = getEnv();
  if (env.aiMock) {
    return {
      name: "AI provider",
      ok: true,
      message: "Skipped: AI_MOCK is true (mock mode).",
    };
  }

  const modelResult = getModel();
  if (!modelResult.ok) {
    return { name: "AI provider", ok: false, message: modelResult.error };
  }

  if (!deep) {
    // getModel() above already confirmed the provider and API key; an empty
    // AI_MODEL falls back to the default model in ai.ts.
    const model = `${getActiveProviderName()}, ${env.aiModel || "default model"}`;
    return {
      name: "AI provider",
      ok: true,
      message: `Configured (${model}); live call skipped. Use ?deep=1 to test it.`,
    };
  }

  try {
    // One tiny request, just to confirm the key and model work.
    await generateText({ model: modelResult.model, prompt: "Reply with the word ok." });
    return { name: "AI provider", ok: true, message: "Reachable." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI provider error.";
    return { name: "AI provider", ok: false, message: `AI request failed: ${message}` };
  }
}

// Runs all checks in parallel and returns one result per integration.
// The live AI call only happens when deep is true; by default the AI check
// just confirms the key and model are configured.
export async function runHealthChecks({ deep = false }: { deep?: boolean } = {}): Promise<CheckResult[]> {
  return Promise.all([checkEnv(), checkSupabase(), checkAiProvider(deep)]);
}
