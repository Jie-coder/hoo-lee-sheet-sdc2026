// Maps raw CV skill strings onto ESCO labels, in three tiers so the free
// tiers get used first:
//   1. exact match (case-insensitive) against the ESCO labels in the
//      catalogue (src/data/catalogue.json, built from data/*.csv),
//   2. a small hand-written synonym list (src/data/skill-synonyms.json),
//   3. everything still unmatched goes into one Gemini embedding call,
//      then a cosine match against skills.embedding in Supabase.
// A skill that clears none of these stays as the raw text the CV said,
// with matched: false, rather than being invented or dropped.
import "server-only";
import { embedMany } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { CATALOGUE } from "@/lib/catalogue";
import { getSupabase } from "@/lib/supabase";
import { getEnv } from "@/lib/env";
import { SCORING_PARAMS } from "@/lib/scoring";
import synonyms from "@/data/skill-synonyms.json";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@/types/contracts";

export type SkillMatchResult = { label: string; matched: boolean };

/** ESCO label (lowercased) -> canonical-cased label, for the exact-match tier. */
const CATALOGUE_LABELS_BY_LOWER = new Map<string, string>(
  Object.values(CATALOGUE.skills).map((label) => [label.toLowerCase(), label]),
);

/** Synonym phrase (lowercased) -> canonical ESCO label, resolved once at import time. */
const SYNONYM_LABELS_BY_LOWER = new Map<string, string>(
  Object.entries(synonyms as Record<string, string>)
    .map(([phrase, skillId]) => [phrase.toLowerCase(), CATALOGUE.skills[skillId]] as const)
    .filter((pair): pair is [string, string] => Boolean(pair[1])),
);

/**
 * Embedding-tier result cache, keyed by the lowercased raw skill text. Lives
 * for the process's lifetime: a demo uploads several CVs with overlapping
 * jargon ("Excel", "CRM", ...), so repeats skip the Gemini + Supabase call.
 * Exported only so tests can reset it between cases.
 */
export const embeddingMatchCache = new Map<string, SkillMatchResult>();

/** One Supabase row from the match_skills RPC (see the migration of the same name). */
type SkillMatchRow = { id: string; label_en: string; similarity: number };

async function embedWithGemini(texts: string[]): Promise<number[][]> {
  const env = getEnv();
  if (!env.googleApiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  const google = createGoogle({ apiKey: env.googleApiKey });
  const { embeddings } = await embedMany({
    model: google.embeddingModel(EMBEDDING_MODEL),
    values: texts,
    maxRetries: 0, // one attempt: a 429 here should fall back to free text, not retry
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
  });
  return embeddings;
}

async function matchEmbeddingInSupabase(embedding: number[]): Promise<{ label: string; similarity: number } | null> {
  const supabase = getSupabase();
  if (!supabase.ok) return null;

  const { data, error } = await supabase.client.rpc("match_skills", {
    query_embedding: embedding,
    match_count: 1,
  });
  if (error || !data || (data as SkillMatchRow[]).length === 0) return null;

  const top = (data as SkillMatchRow[])[0];
  if (top.similarity < SCORING_PARAMS.skillMatchCosine) return null;
  return { label: top.label_en, similarity: top.similarity };
}

export type SkillMatchDeps = {
  /** Default: Gemini embedMany (gemini-embedding-001, 768 dims). */
  embedTexts?: (texts: string[]) => Promise<number[][]>;
  /** Default: the match_skills Supabase RPC, filtered to the cosine >= 0.82 threshold. */
  matchEmbedding?: (embedding: number[]) => Promise<{ label: string; similarity: number } | null>;
};

/**
 * Resolves each raw CV skill string to an ESCO label where possible, in the
 * same order as `rawSkills`. Never throws: an embedding quota hit (429) or
 * any other embedding-stage failure leaves the remaining skills as free
 * text (matched: false) instead of failing the whole CV upload.
 */
export async function mapSkillsToEsco(
  rawSkills: readonly string[],
  deps: SkillMatchDeps = {},
): Promise<SkillMatchResult[]> {
  const embedTexts = deps.embedTexts ?? embedWithGemini;
  const matchEmbedding = deps.matchEmbedding ?? matchEmbeddingInSupabase;

  const results: SkillMatchResult[] = new Array(rawSkills.length);
  const pending: { index: number; text: string; key: string }[] = [];

  rawSkills.forEach((raw, index) => {
    const text = raw.trim();
    const key = text.toLowerCase();

    const exact = CATALOGUE_LABELS_BY_LOWER.get(key);
    if (exact) {
      results[index] = { label: exact, matched: true };
      return;
    }
    const synonym = SYNONYM_LABELS_BY_LOWER.get(key);
    if (synonym) {
      results[index] = { label: synonym, matched: true };
      return;
    }
    const cached = embeddingMatchCache.get(key);
    if (cached) {
      results[index] = cached;
      return;
    }
    pending.push({ index, text, key });
  });

  if (pending.length === 0) return results;

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(pending.map((item) => item.text));
  } catch {
    // Quota (429) or any other embedding failure: the rest stay as free
    // text rather than failing the upload. We deliberately don't log the
    // error — it can carry the request URL, which can carry the API key.
    for (const item of pending) results[item.index] = { label: item.text, matched: false };
    return results;
  }

  await Promise.all(
    pending.map(async (item, i) => {
      const match = await matchEmbedding(embeddings[i]).catch(() => null);
      const resolved: SkillMatchResult = match ? { label: match.label, matched: true } : { label: item.text, matched: false };
      embeddingMatchCache.set(item.key, resolved);
      results[item.index] = resolved;
    }),
  );

  return results;
}
