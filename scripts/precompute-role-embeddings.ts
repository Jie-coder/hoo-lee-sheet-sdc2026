// Precomputes a Gemini embedding for each of the 40 curated Laluan roles'
// titles (src/lib/catalogue.ts, built from data/occupations.csv), so
// src/lib/exposure-estimate.ts can match an unknown job title against them
// by cosine similarity without an embedding call per curated role per
// request. Run once by hand:
//
//   npm run precompute-role-embeddings
//
// Needs GOOGLE_GENERATIVE_AI_API_KEY (same var as the rest of the app, see
// .env.example). The output (src/data/role-embeddings.json) is committed;
// this script is not part of the build or test run. Not run as part of this
// change — the Gemini embedding quota is currently exhausted — so
// src/lib/exposure-estimate.ts must (and does) tolerate that file being
// absent.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { embedMany } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { getEnv } from "../src/lib/env";
import { CATALOGUE } from "../src/lib/catalogue";
import type { RoleEmbeddingsFile } from "../src/lib/exposure-estimate";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../src/types/contracts";
import { isDirectRun } from "./import-data";

export const ROLE_EMBEDDINGS_OUTPUT_PATH = "src/data/role-embeddings.json";

/**
 * Embeds every curated role's title and returns the file shape
 * src/lib/exposure-estimate.ts reads. maxRetries: 3 (unlike production's
 * embedTitleWithGemini, which uses the SDK default): this is a one-off,
 * by-hand run with no request-latency budget to protect, so it's worth
 * retrying a 429 with backoff rather than failing the whole batch.
 */
export async function precomputeRoleEmbeddings(): Promise<RoleEmbeddingsFile> {
  const env = getEnv();
  if (!env.googleApiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }

  const roles = CATALOGUE.occupations.map((occupation) => ({ roleId: occupation.id, title: occupation.title }));

  const google = createGoogle({ apiKey: env.googleApiKey });
  const { embeddings } = await embedMany({
    model: google.embeddingModel(EMBEDDING_MODEL),
    values: roles.map((role) => role.title),
    maxRetries: 3,
    // No providerOptions.google.taskType: src/lib/exposure-estimate.ts embeds
    // the query title the same way, with no taskType either, so the two
    // sides of the cosine comparison are produced consistently.
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
  });

  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    generatedAt: new Date().toISOString(),
    roles: roles.map((role, index) => ({ ...role, embedding: embeddings[index] })),
  };
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  precomputeRoleEmbeddings()
    .then((file) => {
      mkdirSync(dirname(ROLE_EMBEDDINGS_OUTPUT_PATH), { recursive: true });
      writeFileSync(ROLE_EMBEDDINGS_OUTPUT_PATH, `${JSON.stringify(file, null, 2)}\n`);
      console.log(`wrote ${ROLE_EMBEDDINGS_OUTPUT_PATH}: ${file.roles.length} role embeddings`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
