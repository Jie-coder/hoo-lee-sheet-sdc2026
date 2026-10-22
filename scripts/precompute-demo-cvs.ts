// Run once by hand to fill src/data/demo-cv-results.json, so the 3 demo CVs
// parse instantly in the live demo (no Gemini or Supabase call on stage):
//
//   npm run precompute-demo-cvs
//
// Needs these env vars (in .env.local), the same ones `npm run import-data
// -- --apply` needs: GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Reads demo/cv/*.pdf — never under public/, so
// the CVs are never served by the site — and runs the same text-extraction
// + Gemini + ESCO-mapping pipeline as a real upload (src/lib/parse-cv.ts's
// extractAndMapCv). The result is committed; this script is not part of the
// build or test run.
//
// Prints, per CV, each raw skill's mapping tier and (for the embedding tier)
// its top-1 ESCO label and similarity even when below threshold, plus a
// similarity distribution across all CVs — diagnostics for choosing
// CV_SKILL_MATCH_COSINE (src/lib/skill-match.ts). Never logs CV text or keys.
// An embedding-stage error (quota, bad response, Supabase misconfigured,
// RPC failure, ...) is printed sanitised and aborts without writing a
// degraded results file — this script retries a 429 a few times first
// (production, src/lib/skill-match.ts, does not retry).
//
// Flags:
//   --remap-only        Skip PDF/Gemini extraction entirely: reload the
//                        existing OUTPUT_PATH, keep each CV's name/roles/
//                        education, and only re-run ESCO skill mapping (for
//                        tuning CV_SKILL_MATCH_COSINE without burning the
//                        Gemini extraction quota). Previously-matched skills
//                        hold ESCO labels, which resolve again via the exact
//                        tier; unmatched ones hold the CV's original text.
//   --reuse-extractions  Full run, but skip the Gemini extraction call for
//                        any CV already present in EXTRACTION_CACHE_PATH
//                        (gitignored) and reuse its cached raw extraction.
//                        Every full run (with or without this flag) writes
//                        freshly-extracted CVs into that cache.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { embedMany } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { getEnv } from "../src/lib/env";
import { extractAndMapCv, type CvExtraction, type ParsedCvResult, type ParsedSkill, type ParseCvDeps } from "../src/lib/parse-cv";
import { CV_SKILL_MATCH_COSINE, mapSkillsToEsco, skillMatchTier } from "../src/lib/skill-match";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../src/types/contracts";

export const DEMO_CV_DIR = "demo/cv";
export const OUTPUT_PATH = "src/data/demo-cv-results.json";
export const EXTRACTION_CACHE_PATH = ".cache/demo-cv-extractions.json";

type EmbeddingHit = { label: string; similarity: number } | null;

/** Strips a `key=...` query param and any Gemini API key shape, caps length. Diagnostics printing only. */
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const stripped = message.replace(/key=[^&\s]+/gi, "***").replace(/AIza[0-9A-Za-z_-]{20,}/g, "***");
  return stripped.length > 300 ? `${stripped.slice(0, 300)}…` : stripped;
}

/**
 * Gemini embedMany with retries, for this script only: a 429 here is worth
 * retrying with backoff since there's no upload-latency budget to protect,
 * unlike production's embedWithGemini (src/lib/skill-match.ts), which uses
 * maxRetries: 0. Same model, dimensions, and no taskType as production — the
 * stored skill embeddings were computed without one.
 */
async function embedWithRetries(texts: string[]): Promise<number[][]> {
  const env = getEnv();
  if (!env.googleApiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  const google = createGoogle({ apiKey: env.googleApiKey });
  const { embeddings } = await embedMany({
    model: google.embeddingModel(EMBEDDING_MODEL),
    values: texts,
    maxRetries: 3,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
  });
  return embeddings;
}

/** Diagnostics state shared across every CV processed in one run of this script. */
type Diagnostics = {
  embeddingHits: Map<string, EmbeddingHit>;
  allSimilarities: number[];
  errors: string[];
};

function newDiagnostics(): Diagnostics {
  return { embeddingHits: new Map(), allSimilarities: [], errors: [] };
}

function diagnosticsHooks(diagnostics: Diagnostics): Pick<ParseCvDeps, "onEmbeddingMatch" | "onEmbeddingError" | "embedTexts"> {
  return {
    embedTexts: embedWithRetries,
    onEmbeddingMatch: (rawText, top) => {
      diagnostics.embeddingHits.set(rawText.trim().toLowerCase(), top);
      if (top) diagnostics.allSimilarities.push(top.similarity);
    },
    onEmbeddingError: (error) => {
      diagnostics.errors.push(sanitizeError(error));
    },
  };
}

/** Throws (aborting before any output is written) if the embedding stage reported any error so far. */
function assertNoEmbeddingErrors(diagnostics: Diagnostics): void {
  if (diagnostics.errors.length === 0) return;
  console.error("\nEmbedding stage failed — not writing a degraded results file. Sanitised error(s):");
  for (const message of diagnostics.errors) console.error(`  ${message}`);
  throw new Error("Embedding stage failed; see sanitised error(s) above.");
}

function printSkillDiagnostics(rawSkills: readonly string[], skills: readonly ParsedSkill[], diagnostics: Diagnostics): void {
  let matchedCount = 0;
  skills.forEach((skill, i) => {
    const raw = rawSkills[i] ?? skill.label;
    if (skill.matched) matchedCount += 1;

    const tier = skillMatchTier(raw);
    if (tier === "embedding") {
      const hit = diagnostics.embeddingHits.get(raw.trim().toLowerCase());
      const hitText = hit ? `${hit.label} (${hit.similarity.toFixed(3)})` : "no candidate";
      console.log(`  ${raw} -> ${hitText} matched=${skill.matched} tier=embedding`);
    } else {
      console.log(`  ${raw} -> ${skill.label} matched=${skill.matched} tier=${tier}`);
    }
  });
  console.log(`  matched ${matchedCount}/${skills.length} at CV_SKILL_MATCH_COSINE=${CV_SKILL_MATCH_COSINE}`);
}

function percentile(sorted: readonly number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** count, min/max, p10-p90, and a 0.05-wide text histogram from 0.50 to 1.00. */
function printSimilarityDistribution(values: readonly number[]): void {
  if (values.length === 0) return;
  const sorted = [...values].sort((a, b) => a - b);

  console.log("\nEmbedding-tier top-1 similarity distribution (across all CVs):");
  console.log(`  count=${sorted.length} min=${sorted[0].toFixed(3)} max=${sorted[sorted.length - 1].toFixed(3)}`);
  console.log([10, 25, 50, 75, 90].map((p) => `p${p}=${percentile(sorted, p).toFixed(3)}`).join(" "));

  console.log("  histogram (0.05 buckets):");
  const below = sorted.filter((v) => v < 0.5).length;
  if (below > 0) console.log(`    < 0.50: ${"#".repeat(below)} (${below})`);
  for (let i = 0; i < 10; i++) {
    const lo = 0.5 + i * 0.05;
    const hi = lo + 0.05;
    const isLastBucket = i === 9;
    const count = sorted.filter((v) => (isLastBucket ? v >= lo && v <= hi : v >= lo && v < hi)).length;
    console.log(`    ${lo.toFixed(2)}-${hi.toFixed(2)}: ${"#".repeat(count)} (${count})`);
  }
}

function loadJsonSafe<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Full run: PDF text extraction + Gemini extraction + ESCO mapping for every
 * demo CV (src/lib/parse-cv.ts's extractAndMapCv). With reuseExtractions, a
 * CV already in EXTRACTION_CACHE_PATH skips the Gemini extraction call and
 * reuses its cached raw extraction instead — the ESCO mapping (and its
 * diagnostics) still run fresh. Every CV actually extracted this run is
 * written back into that cache.
 */
export async function precomputeDemoCvs(dir: string, options: { reuseExtractions?: boolean } = {}): Promise<Record<string, ParsedCvResult>> {
  const results: Record<string, ParsedCvResult> = {};
  const pdfNames = readdirSync(dir).filter((name) => name.endsWith(".pdf"));
  const extractionCache = loadJsonSafe<Record<string, CvExtraction>>(EXTRACTION_CACHE_PATH, {});
  const diagnostics = newDiagnostics();

  for (const name of pdfNames) {
    const bytes = readFileSync(join(dir, name));
    const hash = createHash("sha256").update(bytes).digest("hex");
    const cached = options.reuseExtractions ? extractionCache[hash] : undefined;

    let rawSkills: string[] = [];
    const deps: ParseCvDeps = {
      ...diagnosticsHooks(diagnostics),
      onExtracted: (extraction) => {
        rawSkills = extraction.skills;
        extractionCache[hash] = extraction;
      },
    };
    if (cached) {
      deps.extractCv = async () => cached;
    }

    const outcome = await extractAndMapCv(new Uint8Array(bytes), deps);
    if (!outcome.ok) {
      throw new Error(`${name}: ${outcome.error}`);
    }
    results[hash] = outcome.result;

    console.log(
      `${name}: sha256 ${hash.slice(0, 12)}… -> ${outcome.result.skills.length} skills${cached ? " (cached extraction)" : ""}`,
    );
    printSkillDiagnostics(rawSkills, outcome.result.skills, diagnostics);
    assertNoEmbeddingErrors(diagnostics);
  }

  mkdirSync(".cache", { recursive: true });
  writeFileSync(EXTRACTION_CACHE_PATH, `${JSON.stringify(extractionCache, null, 2)}\n`);

  printSimilarityDistribution(diagnostics.allSimilarities);
  return results;
}

/**
 * --remap-only: no PDF or Gemini call at all. Reloads OUTPUT_PATH, keeps
 * each CV's name/roles/education, and re-runs mapSkillsToEsco over each
 * CV's existing skill labels (unmatched ones are the CV's raw text;
 * previously-matched ones are ESCO labels, which resolve again via the
 * exact tier) — for tuning CV_SKILL_MATCH_COSINE without Gemini extraction
 * quota.
 */
export async function remapDemoCvs(outputPath: string): Promise<Record<string, ParsedCvResult>> {
  const existing = loadJsonSafe<Record<string, ParsedCvResult>>(outputPath, {});
  const results: Record<string, ParsedCvResult> = {};
  const diagnostics = newDiagnostics();

  for (const [hash, cv] of Object.entries(existing)) {
    const rawSkills = cv.skills.map((skill) => skill.label);
    const skills = await mapSkillsToEsco(rawSkills, diagnosticsHooks(diagnostics));
    results[hash] = { ...cv, skills };

    console.log(`${hash.slice(0, 12)}… (${cv.name || "unnamed"}): ${skills.length} skills remapped`);
    printSkillDiagnostics(rawSkills, skills, diagnostics);
    assertNoEmbeddingErrors(diagnostics);
  }

  printSimilarityDistribution(diagnostics.allSimilarities);
  return results;
}

function isDirectRun(moduleUrl: string, scriptPath: string | undefined): boolean {
  if (!scriptPath) return false;
  return moduleUrl === pathToFileURL(scriptPath).href;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  const args = new Set(process.argv.slice(2));
  const run = args.has("--remap-only")
    ? remapDemoCvs(OUTPUT_PATH)
    : precomputeDemoCvs(DEMO_CV_DIR, { reuseExtractions: args.has("--reuse-extractions") });

  run
    .then((results) => {
      writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`);
      console.log(`wrote ${OUTPUT_PATH}: ${Object.keys(results).length} CVs`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
