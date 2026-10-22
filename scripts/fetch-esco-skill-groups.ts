// Fills data/skill_groups.csv: for every ESCO skill the app knows (in
// occupation_skills.csv, courses.csv, keywords.csv and persona_skills.csv),
// its group in ESCO's own skills hierarchy. Scoring gives half credit when
// a user's skill is in the same ESCO group as a role's essential skill.
//
//   npx tsx scripts/fetch-esco-skill-groups.ts
//
// Never edit skill_groups.csv by hand. Rerun this after fetch-esco-skills.ts.
// Writes nothing if any skill fails to load.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./lib/csv";
import {
  DEFAULT_ESCO_VERSION,
  escoSkillUrl,
  formatSkillGroupsCsv,
  skillGroupFromEsco,
  type EscoSkillResponse,
  type SkillGroupRow,
} from "./lib/esco";
import { isDirectRun } from "./import-data";

const DIR = "data";
const DELAY_MS = 120;
const RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every ESCO skill URI in one column (or a ;-separated list column) of a CSV. */
function urisIn(filename: string, column: string): string[] {
  const { header, rows } = parseCsv(readFileSync(join(DIR, filename), "utf8"));
  const index = header.indexOf(column);
  return rows.flatMap((row) => (row[index] ?? "").split(";").map((uri) => uri.trim()).filter(Boolean));
}

async function fetchSkill(uri: string): Promise<EscoSkillResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(escoSkillUrl(uri, DEFAULT_ESCO_VERSION));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as EscoSkillResponse;
    } catch (error) {
      lastError = error;
      await sleep(DELAY_MS * attempt * 4);
    }
  }
  throw new Error(`${uri}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const asOf = new Date().toISOString().slice(0, 10);
  const uris = [
    ...new Set(
      [
        ...urisIn("occupation_skills.csv", "skill_uri"),
        ...urisIn("courses.csv", "skill_uris"),
        ...urisIn("keywords.csv", "skill_uris"),
        ...urisIn("persona_skills.csv", "esco_uri"),
      ].map((uri) => uri.replace(/^https:/, "http:").toLowerCase()),
    ),
  ].sort();

  const rows: SkillGroupRow[] = [];
  const noGroup: string[] = [];
  const failures: string[] = [];
  for (const [index, uri] of uris.entries()) {
    try {
      const row = skillGroupFromEsco(uri, await fetchSkill(uri), asOf);
      if (row) rows.push(row);
      else noGroup.push(uri);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    if ((index + 1) % 100 === 0) console.log(`${index + 1}/${uris.length}`);
    await sleep(DELAY_MS);
  }

  if (noGroup.length > 0) console.warn(`\n${noGroup.length} skill(s) have no ESCO group (left out)`);
  if (failures.length > 0) {
    console.error(`\nnot written: ${failures.length} skill(s) failed to load:\n  ${failures.slice(0, 10).join("\n  ")}`);
    process.exit(1);
  }
  writeFileSync(join(DIR, "skill_groups.csv"), formatSkillGroupsCsv(rows));
  const groups = new Set(rows.map((row) => row.groupUri)).size;
  console.log(`\nwrote ${rows.length} skill(s) in ${groups} ESCO group(s) to data/skill_groups.csv (ESCO ${DEFAULT_ESCO_VERSION}, as of ${asOf})`);
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
