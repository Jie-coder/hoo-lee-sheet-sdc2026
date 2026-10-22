// Re-counts the arXiv papers behind every keyword in data/keywords.csv and
// writes the counts back: count_last_90d, count_prev_90d, direction
// (up / down / flat, ±10% band) and checked_on. Every other column and the
// row order stay as they are.
//
//   npx tsx scripts/fetch-arxiv.ts                      # windows ending today
//   npx tsx scripts/fetch-arxiv.ts --as-of 2026-09-19   # windows ending on a past date
//   npx tsx scripts/fetch-arxiv.ts --dry-run            # print, don't write
//   npx tsx scripts/fetch-arxiv.ts --as-of 2026-09-19 --out data/keywords_prior.csv
//                                                       # the "30 days ago" snapshot (T10)
//
// arXiv asks for one request every 3 seconds, so 25 keywords take ~2.5 minutes.
// Writes nothing if any request fails, so the file is never half-updated.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { arxivCountUrl, arxivWindows, hasEnoughPapers, parseTotalResults, signalDirection, type DateWindow } from "./lib/arxiv";
import { formatCsv, parseCsv } from "./lib/csv";
import { isDirectRun } from "./import-data";

const DELAY_MS = 3100;
const RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Args = { dir: string; asOf: string; dryRun: boolean; out: string | null };

function parseArgs(argv: string[]): Args {
  const args: Args = { dir: "data", asOf: new Date().toISOString().slice(0, 10), dryRun: false, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir") args.dir = argv[++i];
    else if (argv[i] === "--as-of") args.asOf = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--out") args.out = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.asOf)) throw new Error(`--as-of must be YYYY-MM-DD, got ${args.asOf}`);
  return args;
}

async function countPapers(arxivQuery: string, window: DateWindow): Promise<number> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(arxivCountUrl(arxivQuery, window));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const total = parseTotalResults(await response.text());
      if (total === null) throw new Error("no totalResults in the response");
      return total;
    } catch (error) {
      lastError = error;
      await sleep(DELAY_MS * attempt);
    }
  }
  throw new Error(`${arxivQuery}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const path = join(args.dir, "keywords.csv");
  const csv = parseCsv(readFileSync(path, "utf8"));
  const column = (name: string) => {
    const index = csv.header.indexOf(name);
    if (index < 0) throw new Error(`keywords.csv has no "${name}" column`);
    return index;
  };
  const [keywordCol, queryCol, lastCol, prevCol, directionCol, checkedCol] = [
    "keyword", "arxiv_query", "count_last_90d", "count_prev_90d", "direction", "checked_on",
  ].map(column);

  const { recent, previous } = arxivWindows(args.asOf);
  console.log(`windows: recent ${recent.start}..${recent.end}, previous ${previous.start}..${previous.end}\n`);

  const rows = csv.rows.map((row) => [...row, ...Array(Math.max(0, csv.header.length - row.length)).fill("")]);
  const failures: string[] = [];
  const small: string[] = [];
  for (const row of rows) {
    const query = row[queryCol]?.trim();
    if (!query) continue;
    try {
      const recentCount = await countPapers(query, recent);
      await sleep(DELAY_MS);
      const previousCount = await countPapers(query, previous);
      await sleep(DELAY_MS);
      const before = `${row[lastCol]}/${row[prevCol]} ${row[directionCol]}`;
      row[lastCol] = String(recentCount);
      row[prevCol] = String(previousCount);
      row[directionCol] = signalDirection(recentCount, previousCount);
      row[checkedCol] = args.asOf;
      if (!hasEnoughPapers(recentCount, previousCount)) small.push(row[keywordCol]);
      console.log(
        `${row[keywordCol].padEnd(32)} ${String(recentCount).padStart(5)} vs ${String(previousCount).padStart(5)}  ${row[directionCol].padEnd(4)}  (was ${before})`,
      );
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (small.length > 0) console.warn(`\ntoo few papers to read as a trend (ignored by scoring): ${small.join("; ")}`);
  if (failures.length > 0) {
    console.error(`\nnot written: ${failures.length} keyword(s) failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  if (args.dryRun) {
    console.log("\ndry run: keywords.csv not changed");
    return;
  }
  // Keywords always come from keywords.csv; --out writes the counts to another file (a past snapshot).
  const outPath = args.out ?? path;
  writeFileSync(outPath, formatCsv({ header: csv.header, rows }));
  console.log(`\nwrote ${rows.length} keyword(s) to ${outPath} (as of ${args.asOf}). Next: npm run build-catalogue`);
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
