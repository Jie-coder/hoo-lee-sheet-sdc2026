// Fills data/occupation_skills.csv from the official ESCO API: for every
// occupation in data/occupations.csv with an esco_uri, the skills ESCO
// lists as essential (and optional, with --include-optional).
//
// Never edit occupation_skills.csv by hand: rerun this script instead.
//
//   npx tsx scripts/fetch-esco-skills.ts                    # essential skills, ESCO v1.2.1
//   npx tsx scripts/fetch-esco-skills.ts --include-optional
//   npx tsx scripts/fetch-esco-skills.ts --version v1.2.0 --dir data
//
// Writes nothing if any occupation fails to load, so the file is never half-updated.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./lib/csv";
import {
  DEFAULT_ESCO_VERSION,
  escoOccupationUrl,
  formatOccupationSkillsCsv,
  occupationSkillRowsFromEsco,
  type EscoOccupationResponse,
} from "./lib/esco";
import type { OccupationSkillRow } from "./lib/row-schemas";
import { isDirectRun } from "./import-data";

/** Fewer essential skills than this is worth a second look (T14 "done when"). */
const MIN_ESSENTIAL_SKILLS = 5;
const DELAY_MS = 200;
const RETRIES = 3;

type Args = { dir: string; version: string; includeOptional: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dir: "data", version: DEFAULT_ESCO_VERSION, includeOptional: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir") args.dir = argv[++i];
    else if (argv[i] === "--version") args.version = argv[++i];
    else if (argv[i] === "--include-optional") args.includeOptional = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOccupation(uri: string, version: string): Promise<EscoOccupationResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(escoOccupationUrl(uri, version));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as EscoOccupationResponse;
    } catch (error) {
      lastError = error;
      await sleep(DELAY_MS * attempt * 2);
    }
  }
  throw new Error(`${uri}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const asOf = new Date().toISOString().slice(0, 10);
  const { header, rows } = parseCsv(readFileSync(join(args.dir, "occupations.csv"), "utf8"));
  const column = (name: string) => header.indexOf(name);

  const allRows: OccupationSkillRow[] = [];
  const lowCounts: string[] = [];
  const noUri: string[] = [];
  const failures: string[] = [];

  for (const row of rows) {
    const id = row[column("id")]?.trim();
    const uri = row[column("esco_uri")]?.trim();
    const title = row[column("title_en")]?.trim();
    if (!id) continue;
    if (!uri) {
      noUri.push(`${id} ${title}`);
      continue;
    }
    try {
      const response = await fetchOccupation(uri, args.version);
      const skills = occupationSkillRowsFromEsco(id, response, { includeOptional: args.includeOptional, asOf });
      const essential = skills.filter((skill) => skill.relation === "essential").length;
      if (essential < MIN_ESSENTIAL_SKILLS) lowCounts.push(`${id} ${title}: ${essential}`);
      allRows.push(...skills);
      console.log(`${id} ${title}: ${essential} essential${args.includeOptional ? `, ${skills.length - essential} optional` : ""}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    await sleep(DELAY_MS);
  }

  if (noUri.length > 0) console.warn(`\nskipped, no esco_uri: ${noUri.join("; ")}`);
  if (lowCounts.length > 0) {
    console.warn(`\nfewer than ${MIN_ESSENTIAL_SKILLS} essential skills: ${lowCounts.join("; ")}`);
  }
  if (failures.length > 0) {
    console.error(`\nnot written: ${failures.length} occupation(s) failed to load:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }

  const out = join(args.dir, "occupation_skills.csv");
  writeFileSync(out, formatOccupationSkillsCsv(allRows));
  console.log(`\nwrote ${allRows.length} row(s) to ${out} (ESCO ${args.version}, as of ${asOf})`);
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
