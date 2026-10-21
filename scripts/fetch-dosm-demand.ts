// Fills data/demand.csv from OpenDOSM: Malaysian employees per ISCO major
// group, for the latest year and the year before, for every major group our
// occupations (data/occupations.csv) fall in.
//
//   npx tsx scripts/fetch-dosm-demand.ts            # download and write data/demand.csv
//   npx tsx scripts/fetch-dosm-demand.ts --dry-run  # print the rows and growth, change nothing
//
// Never edit demand.csv by hand. Rerun this after occupations.csv changes, or
// when DOSM publishes a new year (the dataset page says when: "next update").
// The pure logic is in scripts/lib/dosm.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./lib/csv";
import {
  buildDemandRows,
  DOSM_WAGES_OCCUPATION_PAGE,
  DOSM_WAGES_OCCUPATION_URL,
  formatDemandCsv,
  parseWagesOccupationCsv,
  yearOnYearGrowth,
} from "./lib/dosm";
import { isDirectRun } from "./import-data";

const DIR = "data";

/** cluster + isco_code for every occupation in occupations.csv. */
function readOccupations(): { cluster: string; iscoCode: string | null }[] {
  const { header, rows } = parseCsv(readFileSync(join(DIR, "occupations.csv"), "utf8"));
  const cluster = header.indexOf("cluster");
  const isco = header.indexOf("isco_code");
  return rows.map((row) => ({ cluster: row[cluster], iscoCode: row[isco]?.trim() || null }));
}

/**
 * The dataset's "last_updated" date, read from its catalogue page (the CSV
 * itself has no date). Fails loudly rather than guessing a date.
 */
async function fetchLastUpdated(): Promise<string> {
  const page = await (await fetch(DOSM_WAGES_OCCUPATION_PAGE)).text();
  const match = page.match(/"last_updated":"(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`could not read "last_updated" from ${DOSM_WAGES_OCCUPATION_PAGE}`);
  return match[1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const response = await fetch(DOSM_WAGES_OCCUPATION_URL);
  if (!response.ok) throw new Error(`${DOSM_WAGES_OCCUPATION_URL}: HTTP ${response.status}`);
  const records = parseWagesOccupationCsv(await response.text());
  const asOf = await fetchLastUpdated();

  const rows = buildDemandRows(records, readOccupations(), asOf);
  for (const row of rows) {
    const growth = yearOnYearGrowth(Number(row.value), Number(row.prev_value)) * 100;
    console.log(
      `${row.cluster.padEnd(22)} group ${row.isco_major_group}  ${row.prev_period} ${row.prev_value} -> ` +
        `${row.period} ${row.value}  (${growth >= 0 ? "+" : ""}${growth.toFixed(2)}%)`
    );
  }
  console.log(`\nOpenDOSM last updated ${asOf}; ${rows.length} row(s).`);

  if (dryRun) {
    console.log("--dry-run: data/demand.csv not changed");
    return;
  }
  writeFileSync(join(DIR, "demand.csv"), formatDemandCsv(rows));
  console.log("wrote data/demand.csv");
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
