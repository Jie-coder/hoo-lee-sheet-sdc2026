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
import synonyms from "@/data/skill-synonyms.json";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@/types/contracts";

export type SkillMatchResult = { label: string; matched: boolean };

/**
 * Cosine threshold for the CV-skill -> ESCO embedding tier. Deliberately a
 * separate constant from SCORING_PARAMS.skillMatchCosine (0.82): that one
 * matches a user's skill against another skill's label, both drawn from the
 * same ESCO vocabulary. Here we're matching a short, informally-phrased CV
 * skill ("Excel", "customer service") against a long formal ESCO label
 * ("use spreadsheets software") — that phrasing gap pulls cosines down even
 * for a correct match, so a CV-skill threshold copied from scoring.ts would
 * reject good matches. Placeholder until a real similarity distribution
 * (scripts/precompute-demo-cvs.ts's diagnostics output) justifies a value.
 */
export const CV_SKILL_MATCH_COSINE = 0.72;

/** Matches a trailing parenthetical qualifier, e.g. the "(VLOOKUP, pivot tables)" in "Microsoft Excel (VLOOKUP, pivot tables)". */
const TRAILING_PARENTHETICAL = /\s*\([^()]*\)\s*$/;

/**
 * Strips one trailing parenthetical qualifier so "Microsoft Excel (VLOOKUP,
 * pivot tables)" and "QGIS (basic)" look up the same as "Microsoft Excel"
 * and "QGIS" in the exact and synonym tiers. Only those two tiers use this:
 * the embedding tier and the free-text fallback keep the original text, since
 * the qualifier can carry real signal (e.g. a proficiency level) worth
 * embedding, and the UI should show the CV's own wording when nothing matched.
 */
function stripTrailingParenthetical(text: string): string {
  return text.replace(TRAILING_PARENTHETICAL, "").trim();
}

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

export type SkillMatchTier = "exact" | "synonym" | "embedding";

/**
 * Which tier mapSkillsToEsco would route this raw skill text through,
 * without resolving it. Diagnostics only (scripts/precompute-demo-cvs.ts
 * prints this per raw CV skill) — mapSkillsToEsco does not call this itself,
 * it inlines the same two lookups.
 */
export function skillMatchTier(rawText: string): SkillMatchTier {
  const normalizedKey = stripTrailingParenthetical(rawText.trim()).toLowerCase();
  if (CATALOGUE_LABELS_BY_LOWER.has(normalizedKey)) return "exact";
  if (SYNONYM_LABELS_BY_LOWER.has(normalizedKey)) return "synonym";
  return "embedding";
}

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
    // No providerOptions.google.taskType: the 876 skill embeddings already
    // stored in Supabase were computed without one, so a query embedding
    // must be produced the same way or cosines against them are meaningless.
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
  });
  return embeddings;
}

/**
 * Raw top-1 nearest skill by embedding cosine, unfiltered by any threshold —
 * callers (mapSkillsToEsco) decide what counts as a match, so a sub-threshold
 * hit is still visible for diagnostics (see onEmbeddingMatch below).
 *
 * Throws on a configuration or RPC problem (Supabase not configured, or the
 * RPC call itself erroring) rather than returning null for those too: null
 * is reserved for "the RPC ran and found no candidate skill". mapSkillsToEsco
 * catches this per item and reports it via onEmbeddingError, same as any
 * other embedding-stage failure — production behaviour (fall back to free
 * text) is unchanged.
 */
async function matchEmbeddingInSupabase(embedding: number[]): Promise<{ label: string; similarity: number } | null> {
  const supabase = getSupabase();
  if (!supabase.ok) throw new Error(supabase.error);

  const { data, error } = await supabase.client.rpc("match_skills", {
    query_embedding: embedding,
    match_count: 1,
  });
  if (error) throw new Error(`match_skills RPC failed: ${error.message}`);
  if (!data || (data as SkillMatchRow[]).length === 0) return null;

  const top = (data as SkillMatchRow[])[0];
  return { label: top.label_en, similarity: top.similarity };
}

export type SkillMatchDeps = {
  /** Default: Gemini embedMany (gemini-embedding-001, 768 dims). */
  embedTexts?: (texts: string[]) => Promise<number[][]>;
  /** Default: the match_skills Supabase RPC, returning the raw (unfiltered) top-1 hit. */
  matchEmbedding?: (embedding: number[]) => Promise<{ label: string; similarity: number } | null>;
  /**
   * Called once per embedding-tier skill with its raw top-1 hit, even when
   * that hit is below CV_SKILL_MATCH_COSINE. Diagnostics only (e.g.
   * scripts/precompute-demo-cvs.ts build a similarity distribution from
   * this to help pick the threshold) — does not affect matching.
   */
  onEmbeddingMatch?: (rawText: string, top: { label: string; similarity: number } | null) => void;
  /**
   * Called with every error the embedding stage throws (embedTexts or
   * matchEmbedding) — a quota hit, a malformed response, Supabase not
   * configured, a failing RPC, etc. Diagnostics only: production code never
   * sets this, so the error stays unlogged there (it can carry the request
   * URL, which can carry the API key) and the skill still falls back to free
   * text. scripts/precompute-demo-cvs.ts sets this to print a sanitised
   * message and fail loudly instead of writing a degraded results file.
   */
  onEmbeddingError?: (error: unknown) => void;
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
  const onEmbeddingMatch = deps.onEmbeddingMatch;
  const onEmbeddingError = deps.onEmbeddingError;

  const results: SkillMatchResult[] = new Array(rawSkills.length);
  const pending: { index: number; text: string; key: string }[] = [];

  rawSkills.forEach((raw, index) => {
    const text = raw.trim();
    const normalizedKey = stripTrailingParenthetical(text).toLowerCase();

    const exact = CATALOGUE_LABELS_BY_LOWER.get(normalizedKey);
    if (exact) {
      results[index] = { label: exact, matched: true };
      return;
    }
    const synonym = SYNONYM_LABELS_BY_LOWER.get(normalizedKey);
    if (synonym) {
      results[index] = { label: synonym, matched: true };
      return;
    }
    const key = text.toLowerCase();
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
  } catch (error) {
    // Quota (429) or any other embedding failure: the rest stay as free
    // text rather than failing the upload. We deliberately don't log the
    // error ourselves — it can carry the request URL, which can carry the
    // API key — but a caller that opted in via onEmbeddingError still sees it.
    onEmbeddingError?.(error);
    for (const item of pending) results[item.index] = { label: item.text, matched: false };
    return results;
  }

  await Promise.all(
    pending.map(async (item, i) => {
      const top = await matchEmbedding(embeddings[i]).catch((error: unknown) => {
        onEmbeddingError?.(error);
        return null;
      });
      onEmbeddingMatch?.(item.text, top);
      const matched = top != null && top.similarity >= CV_SKILL_MATCH_COSINE;
      const resolved: SkillMatchResult = matched ? { label: top.label, matched: true } : { label: item.text, matched: false };
      embeddingMatchCache.set(item.key, resolved);
      results[item.index] = resolved;
    }),
  );

  return results;
}
