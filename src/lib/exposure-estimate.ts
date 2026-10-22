// Estimates GenAI exposure for a job title that is NOT one of the 40
// curated Laluan roles (data/occupations.csv / src/lib/catalogue.ts), by
// embedding the title with Gemini and borrowing the closest curated role's
// exposure figure when the two are close enough. Precomputed role
// embeddings live in src/data/role-embeddings.json (written once by
// scripts/precompute-role-embeddings.ts); this module statically imports
// that file so it's bundled at build time rather than read from disk per
// request. The placeholder checked into the repo before that script has
// ever run is `[]`, which fails the object-shaped schema below and so
// resolves to null — POST /api/exposure-estimate just returns
// { status: "embeddings_unavailable" }.
import "server-only";
import { embed } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { CATALOGUE, type CatalogueExposure } from "@/lib/catalogue";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@/types/contracts";
import roleEmbeddingsJson from "@/data/role-embeddings.json";

/**
 * Cosine threshold for borrowing a curated role's exposure figure for an
 * unknown job title. Set higher than CV_SKILL_MATCH_COSINE (0.72, see
 * src/lib/skill-match.ts) and SCORING_PARAMS.skillMatchCosine (0.82, see
 * src/lib/scoring.ts): both of those match a short skill phrase against an
 * ESCO label drawn from the same controlled vocabulary, where some phrasing
 * gap is expected and a miss just falls back to free text. Here a match
 * substitutes one occupation's whole published exposure figure for
 * another's and presents it to the user as that role's number, so a false
 * positive (two different roles treated as the same one) is more
 * consequential than a false negative (which only falls back to
 * "no_close_match", not an error). 0.80 is set high enough to require
 * near-synonyms ("web developer" vs "website developer") while rejecting
 * same-cluster-but-different roles ("web developer" vs "mobile application
 * developer"). Placeholder until a real similarity distribution — only
 * obtainable once scripts/precompute-role-embeddings.ts can actually be run
 * (see its header: Gemini embedding quota is currently exhausted) —
 * justifies a different value.
 */
export const EXPOSURE_MATCH_THRESHOLD = 0.8;

export type RoleEmbedding = { roleId: string; title: string; embedding: number[] };

export type RoleEmbeddingsFile = {
  model: string;
  dimensions: number;
  generatedAt: string;
  roles: RoleEmbedding[];
};

const RoleEmbeddingSchema = z.strictObject({
  roleId: z.string().min(1),
  title: z.string().min(1),
  embedding: z.array(z.number()).min(1),
});

const RoleEmbeddingsFileSchema = z.strictObject({
  model: z.string().min(1),
  dimensions: z.number().int().positive(),
  generatedAt: z.string().min(1),
  roles: z.array(RoleEmbeddingSchema),
});

export type BorrowedFrom = { roleId: string; title: string };

export type ExposureEstimateResult =
  | { status: "exact"; exposure: CatalogueExposure | null; borrowedFrom: BorrowedFrom; similarity: 1 }
  | { status: "matched"; exposure: CatalogueExposure | null; borrowedFrom: BorrowedFrom; similarity: number }
  | { status: "no_close_match" }
  | { status: "embeddings_unavailable" };

/** Collapses whitespace and case so title comparisons ignore formatting, not meaning. */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Cosine similarity of two equal-length vectors, in [-1, 1]. Returns 0 for a
 * zero vector (undefined direction) instead of dividing by zero.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have the same length (got ${a.length} and ${b.length}).`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Validates the statically-imported role-embeddings JSON. Returns null for
 * any shape that doesn't match RoleEmbeddingsFileSchema -- including the
 * `[]` placeholder committed before scripts/precompute-role-embeddings.ts
 * has ever run. An empty roles list in an otherwise valid file is still
 * returned as-is; estimateExposure treats zero roles the same as null.
 */
function parseRoleEmbeddings(json: unknown): RoleEmbeddingsFile | null {
  const parsed = RoleEmbeddingsFileSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Validated once at module load, since the import is static (bundled, not re-read per request). */
const STATIC_ROLE_EMBEDDINGS = parseRoleEmbeddings(roleEmbeddingsJson);

function loadRoleEmbeddingsFromModule(): RoleEmbeddingsFile | null {
  return STATIC_ROLE_EMBEDDINGS;
}

async function embedTitleWithGemini(title: string): Promise<number[]> {
  const env = getEnv();
  if (!env.googleApiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  const google = createGoogle({ apiKey: env.googleApiKey });
  const { embedding } = await embed({
    model: google.embeddingModel(EMBEDDING_MODEL),
    value: title,
    // No providerOptions.google.taskType: scripts/precompute-role-embeddings.ts
    // computes the stored role embeddings without one, so a query embedding
    // must be produced the same way or cosines against them are meaningless.
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
  });
  return embedding;
}

export type ExposureEstimateDeps = {
  /** Default: Gemini embed (gemini-embedding-001, 768 dims). Inject a stub in tests to avoid any network call. */
  embedTitle?: (title: string) => Promise<number[]>;
  /** Default: the statically-imported + zod-validated src/data/role-embeddings.json. */
  loadRoleEmbeddings?: () => RoleEmbeddingsFile | null;
};

/**
 * Estimates exposure for a job title that may not be one of the 40 curated
 * Laluan roles. Never throws: a missing/empty embeddings file, or a failure
 * embedding the title (quota, bad response, no API key, ...), both resolve
 * to { status: "embeddings_unavailable" } rather than an exception.
 */
export async function estimateExposure(title: string, deps: ExposureEstimateDeps = {}): Promise<ExposureEstimateResult> {
  const normalized = normalizeTitle(title);

  const exactRole = CATALOGUE.occupations.find((occupation) => normalizeTitle(occupation.title) === normalized);
  if (exactRole) {
    return {
      status: "exact",
      exposure: exactRole.exposure,
      borrowedFrom: { roleId: exactRole.id, title: exactRole.title },
      similarity: 1,
    };
  }

  const loadRoleEmbeddings = deps.loadRoleEmbeddings ?? loadRoleEmbeddingsFromModule;
  const file = loadRoleEmbeddings();
  if (!file || file.roles.length === 0) {
    return { status: "embeddings_unavailable" };
  }

  const embedTitle = deps.embedTitle ?? embedTitleWithGemini;
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedTitle(title.trim());
  } catch {
    // A quota hit, network error, or missing API key: we cannot produce a
    // query embedding, so we cannot compare against the stored role
    // embeddings either. Same outward status as the file being absent --
    // from the caller's point of view, embedding-based matching just isn't
    // available right now.
    return { status: "embeddings_unavailable" };
  }

  let best: { roleId: string; title: string; similarity: number } | null = null;
  for (const role of file.roles) {
    const similarity = cosineSimilarity(queryEmbedding, role.embedding);
    if (!best || similarity > best.similarity) {
      best = { roleId: role.roleId, title: role.title, similarity };
    }
  }
  if (!best || best.similarity < EXPOSURE_MATCH_THRESHOLD) {
    return { status: "no_close_match" };
  }

  const catalogueRole = CATALOGUE.occupations.find((occupation) => occupation.id === best.roleId);
  return {
    status: "matched",
    exposure: catalogueRole?.exposure ?? null,
    borrowedFrom: { roleId: best.roleId, title: best.title },
    similarity: best.similarity,
  };
}
