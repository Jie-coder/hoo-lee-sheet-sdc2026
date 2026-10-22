// Factories for the two live clients --apply needs. Both are plain
// functions so tests can inject a fake instead of hitting the network.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createGoogle } from "@ai-sdk/google";
import { embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../../src/types/contracts";
import type { ApplyEnv } from "./env";
import { callWithQuotaRetry } from "./embedding-quota";

export function createSupabaseClientFor(env: ApplyEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}

/** Embeds a batch of texts with Gemini, returning one 768-d vector per text. */
export type Embedder = (texts: string[]) => Promise<number[][]>;

export function createEmbedderFor(
  env: ApplyEnv,
  options: { sleep?: (ms: number) => Promise<void> } = {}
): Embedder {
  const google = createGoogle({ apiKey: env.geminiApiKey });
  const model = google.embeddingModel(EMBEDDING_MODEL);

  return async (texts: string[]) => {
    if (texts.length === 0) return [];

    const { embeddings } = await callWithQuotaRetry(
      () =>
        embedMany({
          model,
          values: texts,
          // We retry 429s ourselves (callWithQuotaRetry), honouring Google's
          // own retryDelay instead of the AI SDK's fixed backoff — so the AI
          // SDK must not also retry underneath us.
          maxRetries: 0,
          // Google-specific option name for the API's outputDimensionality
          // field (vector(768) in the schema). The generic embedMany
          // `dimensions` option happens to reach the same field for this
          // provider, but this is the documented, provider-correct way to
          // set it — see /tmp/model-finding.md for the full check.
          providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
        }),
      { sleep: options.sleep }
    );
    for (const embedding of embeddings) {
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Gemini returned a ${embedding.length}-d embedding, expected ${EMBEDDING_DIMENSIONS}.`
        );
      }
    }
    return embeddings;
  };
}
