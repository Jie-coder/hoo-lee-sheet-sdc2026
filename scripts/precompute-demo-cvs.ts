// Run once by hand to fill src/data/demo-cv-results.json, so the 3 demo CVs
// parse instantly in the live demo (no Gemini or Supabase call on stage):
//
//   npx tsx scripts/precompute-demo-cvs.ts
//
// Needs GOOGLE_GENERATIVE_AI_API_KEY and Supabase env vars in .env.local
// (same vars as `npm run import-data -- --apply`). Reads demo/cv/*.pdf —
// never under public/, so the CVs are never served by the site — and runs
// the same text-extraction + Gemini + ESCO-mapping pipeline as a real
// upload (src/lib/parse-cv.ts's extractAndMapCv). The result is committed;
// this script is not part of the build or test run.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractAndMapCv, type ParsedCvResult } from "../src/lib/parse-cv";

export const DEMO_CV_DIR = "demo/cv";
export const OUTPUT_PATH = "src/data/demo-cv-results.json";

export async function precomputeDemoCvs(dir: string): Promise<Record<string, ParsedCvResult>> {
  const results: Record<string, ParsedCvResult> = {};
  const pdfNames = readdirSync(dir).filter((name) => name.endsWith(".pdf"));

  for (const name of pdfNames) {
    const bytes = readFileSync(join(dir, name));
    const hash = createHash("sha256").update(bytes).digest("hex");
    const outcome = await extractAndMapCv(new Uint8Array(bytes));
    if (!outcome.ok) {
      throw new Error(`${name}: ${outcome.error}`);
    }
    results[hash] = outcome.result;
    console.log(`${name}: sha256 ${hash.slice(0, 12)}… -> ${outcome.result.skills.length} skills`);
  }

  return results;
}

function isDirectRun(moduleUrl: string, scriptPath: string | undefined): boolean {
  if (!scriptPath) return false;
  return moduleUrl === pathToFileURL(scriptPath).href;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  precomputeDemoCvs(DEMO_CV_DIR)
    .then((results) => {
      writeFileSync(OUTPUT_PATH, `${JSON.stringify(results, null, 2)}\n`);
      console.log(`wrote ${OUTPUT_PATH}: ${Object.keys(results).length} CVs`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
