// Estimates GenAI exposure for a job title that may not be one of the 40
// curated Laluan roles. Order: (1) exact title match on the 40, (2) the
// precomputed alias table (src/data/role-aliases.json), (3) the configured
// chat model (getModel(): Claude Haiku on Replit, Gemini on Vercel) picks one
// of the 40 ids or "none". A model answer outside the 40 is treated as no
// close match. Exposure is always the matched catalogue role's real figure.
//
// The earlier embedding path (role-embeddings.json) is no longer on this
// request path; RoleEmbeddingsFile / cosineSimilarity stay exported for
// scripts/precompute-role-embeddings.ts.
import "server-only";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { CATALOGUE, type CatalogueExposure } from "@/lib/catalogue";
import { lookupRoleAlias } from "@/lib/role-aliases";

export type RoleEmbedding = { roleId: string; title: string; embedding: number[] };

export type RoleEmbeddingsFile = {
  model: string;
  dimensions: number;
  generatedAt: string;
  roles: RoleEmbedding[];
};

/** Cosine similarity of two equal-length vectors; 0 for a zero vector. */
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

export type BorrowedFrom = { roleId: string; title: string };
export type MatchedVia = "exact" | "alias" | "llm";

export type ExposureEstimateResult =
  | { status: "matched"; matchedVia: MatchedVia; exposure: CatalogueExposure | null; borrowedFrom: BorrowedFrom }
  | { status: "no_close_match"; matchedVia: "alias" | "llm" }
  | { status: "model_unavailable" };

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

const PickSchema = z.object({ roleId: z.string() });

async function defaultPickRole(title: string): Promise<string> {
  const modelResult = getModel();
  if (!modelResult.ok) throw new Error(modelResult.error);
  return pickRoleWithModel(modelResult.model, title);
}

export async function pickRoleWithModel(model: LanguageModel, title: string): Promise<string> {
  const list = CATALOGUE.occupations.map((o) => `${o.id}: ${o.title}`).join("\n");
  const { object } = await generateObject({
    model,
    schema: PickSchema,
    system:
      "You map a job title (English, Bahasa Malaysia or other) to the single closest role in a fixed list. " +
      'Answer with that role\'s id only if it is essentially the same job; otherwise answer "none".',
    prompt: `Roles:\n${list}\n\nJob title: ${title}`,
  });
  return object.roleId.trim();
}

export type ExposureEstimateDeps = {
  /** Default: getModel() + generateObject. Returns a catalogue id or "none". Inject a stub in tests. */
  pickRole?: (title: string) => Promise<string>;
};

function matched(roleId: string, matchedVia: MatchedVia): ExposureEstimateResult | null {
  const role = CATALOGUE.occupations.find((o) => o.id === roleId);
  if (!role) return null;
  return { status: "matched", matchedVia, exposure: role.exposure, borrowedFrom: { roleId: role.id, title: role.title } };
}

/** Never throws: a model/config failure resolves to { status: "model_unavailable" }. */
export async function estimateExposure(title: string, deps: ExposureEstimateDeps = {}): Promise<ExposureEstimateResult> {
  const normalized = normalizeTitle(title);
  const exactRole = CATALOGUE.occupations.find((o) => normalizeTitle(o.title) === normalized);
  if (exactRole) return matched(exactRole.id, "exact")!;

  const alias = lookupRoleAlias(title);
  if (alias === null) return { status: "no_close_match", matchedVia: "alias" };
  if (alias !== undefined) {
    const hit = matched(alias, "alias");
    if (hit) return hit;
  }

  const pickRole = deps.pickRole ?? defaultPickRole;
  let picked: string;
  try {
    picked = await pickRole(title.trim());
  } catch {
    return { status: "model_unavailable" };
  }
  return matched(picked, "llm") ?? { status: "no_close_match", matchedVia: "llm" };
}
