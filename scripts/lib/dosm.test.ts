// scripts/fixtures/dosm/wages_occupation.csv is a cut-down copy of the real
// OpenDOSM file (2024 and 2025 rows as published; 2023 left incomplete on
// purpose, plus one "male" row that must be ignored).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildDemandRows,
  clusterMajorGroups,
  DOSM_SOURCE_NAME,
  DOSM_WAGES_OCCUPATION_URL,
  formatDemandCsv,
  latestTwoYears,
  parseWagesOccupationCsv,
  yearOnYearGrowth,
} from "./dosm";
import { mapDemandRow } from "./mappers";
import { parseCsv } from "./csv";

const FIXTURE = readFileSync("scripts/fixtures/dosm/wages_occupation.csv", "utf8");

describe("parseWagesOccupationCsv", () => {
  it("keeps sex = both rows for the 9 major groups, and drops 'overall' and other sexes", () => {
    const records = parseWagesOccupationCsv(FIXTURE);
    expect(records.every((record) => record.occupation !== "overall")).toBe(true);
    expect(records.filter((record) => record.year === "2024" && record.occupation === "professionals")).toEqual([
      { year: "2024", occupation: "professionals", recipients: 1895.8 },
    ]);
  });

  it("fails loudly when a column is missing", () => {
    expect(() => parseWagesOccupationCsv("sex,date,occupation\nboth,2025-01-01,managers\n")).toThrow(/recipients/);
  });
});

describe("latestTwoYears", () => {
  it("picks the latest complete year and the one before (2023 is incomplete)", () => {
    expect(latestTwoYears(parseWagesOccupationCsv(FIXTURE))).toEqual({ period: "2025", prevPeriod: "2024" });
  });
});

describe("clusterMajorGroups", () => {
  it("counts occupations per first ISCO digit, ignoring a blank code", () => {
    const groups = clusterMajorGroups([
      { cluster: "green_sustainability", iscoCode: "2149" },
      { cluster: "green_sustainability", iscoCode: "2143" },
      { cluster: "green_sustainability", iscoCode: "7411" },
      { cluster: "green_sustainability", iscoCode: null },
    ]);
    expect(groups.get("green_sustainability")).toEqual(new Map([["2", 2], ["7", 1]]));
  });
});

describe("buildDemandRows", () => {
  const occupations = [
    { cluster: "routine_clerical", iscoCode: "4132" },
    { cluster: "routine_clerical", iscoCode: "5244" },
    { cluster: "ai_digital", iscoCode: "2512" },
    // Armed forces: not in the DOSM file, so it gets no row (never guessed).
    { cluster: "ai_digital", iscoCode: "0110" },
  ];
  const rows = buildDemandRows(parseWagesOccupationCsv(FIXTURE), occupations, "2026-09-21");

  it("copies DOSM's recipients as published, one row per cluster and major group", () => {
    expect(rows.map((row) => [row.cluster, row.isco_major_group, row.value, row.prev_value])).toEqual([
      ["ai_digital", "2", "1945.4", "1895.8"],
      ["routine_clerical", "4", "1360.1", "1334.5"],
      ["routine_clerical", "5", "2305.7", "2243.6"],
    ]);
  });

  it("cites the dataset, the period and the as-of date on every row", () => {
    expect(rows[0]).toMatchObject({
      period: "2025",
      prev_period: "2024",
      source_name: DOSM_SOURCE_NAME,
      source_url: DOSM_WAGES_OCCUPATION_URL,
      table_or_dataset: "wages_occupation, sex=both, occupation=professionals",
      as_of: "2026-09-21",
    });
    expect(rows[0].notes).toContain("1 of 2 ai_digital occupations");
  });

  it("writes a demand.csv that the importer reads back with no issues", () => {
    const { header, rows: csvRows } = parseCsv(formatDemandCsv(rows));
    csvRows.forEach((cells, index) => {
      const raw = Object.fromEntries(header.map((column, i) => [column, cells[i]]));
      expect(mapDemandRow(raw, index + 2).issues).toEqual([]);
    });
  });
});

describe("yearOnYearGrowth", () => {
  it("is value / prev_value − 1", () => {
    expect(yearOnYearGrowth(1100, 1000)).toBeCloseTo(0.1);
    expect(yearOnYearGrowth(990, 1000)).toBeCloseTo(-0.01);
  });
});
