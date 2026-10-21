// Pure functions for scripts/fetch-dosm-demand.ts: read OpenDOSM's
// "Annual Salaries & Wages by Occupation & Sex" file and turn it into
// demand.csv rows. No network here, so tests can use a small fixture file.
//
// Dataset: https://open.dosm.gov.my/data-catalogue/wages_occupation
// File:    https://storage.dosm.gov.my/labour/wages_occupation.csv
// Licence: CC BY 4.0 (as stated on the dataset page).
//
// "recipients" is the number of employees (Malaysian citizens) receiving
// salaries & wages, in thousands, per MASCO-2020 major group. It is the only
// OpenDOSM dataset that splits workers by occupation group, so we use it as
// the employment count. It is employees only: employers, own-account and
// unpaid family workers, and non-citizens are not in it.
import { formatCsv, parseCsv } from "./csv";

export const DOSM_WAGES_OCCUPATION_URL = "https://storage.dosm.gov.my/labour/wages_occupation.csv";
export const DOSM_WAGES_OCCUPATION_PAGE = "https://open.dosm.gov.my/data-catalogue/wages_occupation";
export const DOSM_SOURCE_NAME = "OpenDOSM Salaries & Wages by Occupation";
export const DOSM_METRIC = "salaries_wages_recipients_thousands";

/**
 * OpenDOSM's occupation labels -> MASCO / ISCO-08 major group (first digit of
 * the code). MASCO-2020 follows ISCO-08's major groups one to one.
 */
export const MASCO_MAJOR_GROUPS: Record<string, string> = {
  managers: "1",
  professionals: "2",
  technicians: "3",
  clerical: "4",
  service_sales: "5",
  agriculture: "6",
  craft: "7",
  operators: "8",
  elementary: "9",
};

/** One row of the OpenDOSM file, for both sexes. */
export type WagesOccupationRecord = {
  year: string;
  occupation: string;
  recipients: number;
};

/** Reads the OpenDOSM CSV, keeping only sex = "both" rows with a known occupation group. */
export function parseWagesOccupationCsv(text: string): WagesOccupationRecord[] {
  const { header, rows } = parseCsv(text);
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`OpenDOSM file has no "${name}" column (got: ${header.join(", ")})`);
    return index;
  };
  const sex = column("sex");
  const date = column("date");
  const occupation = column("occupation");
  const recipients = column("recipients");

  return rows
    .filter((row) => row[sex] === "both" && row[occupation] in MASCO_MAJOR_GROUPS)
    .map((row) => ({
      // Annual data: DOSM sets the date to YYYY-01-01.
      year: row[date].slice(0, 4),
      occupation: row[occupation],
      recipients: Number(row[recipients]),
    }));
}

/** The latest year in the file that has every major group, and the year before it. */
export function latestTwoYears(records: WagesOccupationRecord[]): { period: string; prevPeriod: string } {
  const groupCount = Object.keys(MASCO_MAJOR_GROUPS).length;
  const complete = [...new Set(records.map((record) => record.year))]
    .filter((year) => records.filter((record) => record.year === year).length === groupCount)
    .sort();
  const period = complete[complete.length - 1];
  const prevPeriod = String(Number(period) - 1);
  if (!period || !complete.includes(prevPeriod)) {
    throw new Error("OpenDOSM file needs two back-to-back complete years");
  }
  return { period, prevPeriod };
}

/** Major group digit -> how many of a cluster's occupations are in it, from occupations.csv isco_code. */
export function clusterMajorGroups(
  occupations: { cluster: string; iscoCode: string | null }[]
): Map<string, Map<string, number>> {
  const byCluster = new Map<string, Map<string, number>>();
  for (const { cluster, iscoCode } of occupations) {
    if (!iscoCode) continue;
    const group = iscoCode.trim().charAt(0);
    const groups = byCluster.get(cluster) ?? new Map<string, number>();
    groups.set(group, (groups.get(group) ?? 0) + 1);
    byCluster.set(cluster, groups);
  }
  return byCluster;
}

export const DEMAND_HEADER = [
  "cluster",
  "isco_major_group",
  "metric",
  "value",
  "period",
  "prev_value",
  "prev_period",
  "source_name",
  "source_url",
  "table_or_dataset",
  "as_of",
  "notes",
];

export type DemandCsvRow = Record<(typeof DEMAND_HEADER)[number], string>;

/**
 * One demand.csv row per (cluster, major group) that the cluster's
 * occupations fall in. value / prev_value are DOSM's recipients for that
 * major group, copied as published: nothing is computed or rounded here.
 * asOf is the dataset's own "last updated" date.
 */
export function buildDemandRows(
  records: WagesOccupationRecord[],
  occupations: { cluster: string; iscoCode: string | null }[],
  asOf: string
): DemandCsvRow[] {
  const { period, prevPeriod } = latestTwoYears(records);
  const recipients = (year: string, group: string) =>
    records.find((record) => record.year === year && MASCO_MAJOR_GROUPS[record.occupation] === group);

  const rows: DemandCsvRow[] = [];
  const clusters = clusterMajorGroups(occupations);
  for (const cluster of [...clusters.keys()].sort()) {
    const groups = clusters.get(cluster) as Map<string, number>;
    const total = [...groups.values()].reduce((sum, count) => sum + count, 0);
    for (const group of [...groups.keys()].sort()) {
      const now = recipients(period, group);
      const before = recipients(prevPeriod, group);
      // ISCO group 0 (armed forces) is not in the DOSM file: leave it out, never guess.
      if (!now || !before) continue;
      rows.push({
        cluster,
        isco_major_group: group,
        metric: DOSM_METRIC,
        value: String(now.recipients),
        period,
        prev_value: String(before.recipients),
        prev_period: prevPeriod,
        source_name: DOSM_SOURCE_NAME,
        source_url: DOSM_WAGES_OCCUPATION_URL,
        table_or_dataset: `wages_occupation, sex=both, occupation=${now.occupation}`,
        as_of: asOf,
        notes:
          `${groups.get(group)} of ${total} ${cluster} occupations in occupations.csv are in ISCO major group ${group}. ` +
          "Employees who are Malaysian citizens, in thousands.",
      });
    }
  }
  return rows;
}

export function formatDemandCsv(rows: DemandCsvRow[]): string {
  return formatCsv({ header: DEMAND_HEADER, rows: rows.map((row) => DEMAND_HEADER.map((column) => row[column])) });
}

/** Year-on-year growth as a fraction: 0.026 means +2.6%. */
export function yearOnYearGrowth(value: number, prevValue: number): number {
  return value / prevValue - 1;
}

