// Factories for the two live clients --apply needs. Both are plain
// functions so tests can inject a fake instead of hitting the network.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createGoogle } from "@ai-sdk/google";
import { embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../../src/types/contracts";
import type { ApplyEnv } from "./env";

export function createSupabaseClientFor(env: ApplyEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}

/** Embeds a batch of texts with Gemini, returning one 768-d vector per text. */
export type Embedder = (texts: string[]) => Promise<number[][]>;

export function createEmbedderFor(env: ApplyEnv): Embedder {
  const google = createGoogle({ apiKey: env.geminiApiKey });
  const model = google.embeddingModel(EMBEDDING_MODEL);

  return async (texts: string[]) => {
    if (texts.length === 0) return [];
    const { embeddings } = await embedMany({
      model,
      values: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
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
