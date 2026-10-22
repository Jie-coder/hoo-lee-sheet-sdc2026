// Proves the rows this importer builds for --apply actually match the live
// schema (scripts/fixtures/live-schema.json, read from information_schema):
// every key is a real column, every NOT NULL column with no default is
// present and non-null, and the JS value's type matches the column's udt
// type. Runs against the real data/*.csv files through the real mappers —
// not the scripts/fixtures/valid test fixtures — so this only proves
// something about what would actually be sent to Supabase.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import {
  arxivQueryUrl,
  buildCourseRows,
  buildExposureRows,
  buildOccupationRows,
  buildOccupationSkillRows,
  buildProgramRows,
  buildScenarioRows,
  buildSignalRows,
  buildSkillRows,
  buildSourceRows,
  SIGNALS_ON_CONFLICT,
} from "./apply";
import { deriveSkills, runFile } from "../import-data";
import liveSchema from "../fixtures/live-schema.json";

const DATA_DIR = "data";

type ColumnSpec = { type: string; nullable: boolean; hasDefault: boolean };
type TableSchema = Record<string, ColumnSpec>;

const TABLES = (liveSchema as { tables: Record<string, TableSchema> }).tables;

function tableSchema(table: string): TableSchema {
  const schema = TABLES[table];
  if (!schema) throw new Error(`"${table}" is not a table in live-schema.json`);
  return schema;
}

/** True when a built JS value's type matches a live-schema udt type. */
function valueMatchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "text":
      return typeof value === "string";
    case "_text":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case "numeric":
    case "int8":
      return typeof value === "number";
    case "bool":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "jsonb":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "vector":
      return Array.isArray(value) && value.every((item) => typeof item === "number");
    default:
      return true;
  }
}

/**
 * Asserts a set of built rows for one table: every key is a real column,
 * every NOT NULL column with no default is present and non-null (unless
 * named in `allowMissing`, for a column this importer deliberately never
 * sets), and every present value's JS type matches its udt type.
 */
function assertRowsMatchSchema(
  table: string,
  rows: Record<string, unknown>[],
  options: { allowMissing?: Set<string> } = {}
): void {
  const schema = tableSchema(table);
  const allowMissing = options.allowMissing ?? new Set();
  expect(rows.length, `no rows built for ${table} — nothing to prove`).toBeGreaterThan(0);

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      expect(schema, `${table}.${key}: not a column in live-schema.json`).toHaveProperty(key);
    }

    for (const [column, spec] of Object.entries(schema)) {
      const required = !spec.nullable && !spec.hasDefault;
      if (required && !allowMissing.has(column)) {
        expect(row, `${table}.${column}: NOT NULL with no default, but missing from the built row`).toHaveProperty(
          column
        );
        expect(row[column], `${table}.${column}: NOT NULL, but built as null/undefined`).not.toBeNull();
        expect(row[column]).not.toBeUndefined();
      }

      if (column in row && row[column] !== null) {
        expect(
          valueMatchesType(row[column], spec.type),
          `${table}.${column}: ${JSON.stringify(row[column])} does not match udt type "${spec.type}"`
        ).toBe(true);
      }
    }
  }
}

const coursesOutcome = runFile("courses", DATA_DIR);
const occupationsOutcome = runFile("occupations", DATA_DIR);
const programmesOutcome = runFile("programmes", DATA_DIR);
const keywordsOutcome = runFile("keywords", DATA_DIR);
const sourcesOutcome = runFile("sources", DATA_DIR);
const exposureOutcome = runFile("exposure", DATA_DIR);
const occupationSkillsOutcome = runFile("occupation_skills", DATA_DIR);
const demandOutcome = runFile("demand", DATA_DIR);
const scenariosOutcome = runFile("scenarios", DATA_DIR);

const skills = deriveSkills([...coursesOutcome.skillPairs, ...keywordsOutcome.skillPairs]);
const emptyEmbeddings = new Map<string, number[]>();

describe("built rows match scripts/fixtures/live-schema.json", () => {
  it("courses.csv -> public.courses", () => {
    expect(coursesOutcome.fileReport.invalidRows).toBe(0);
    assertRowsMatchSchema("courses", buildCourseRows(coursesOutcome.validCourses));
  });

  it("occupations.csv -> public.occupations", () => {
    expect(occupationsOutcome.fileReport.invalidRows).toBe(0);
    assertRowsMatchSchema(
      "occupations",
      buildOccupationRows(occupationsOutcome.validOccupations, emptyEmbeddings),
      // embedding is nullable and intentionally not computed in this test.
      { allowMissing: new Set() }
    );
  });

  it("programmes.csv -> public.programs", () => {
    expect(programmesOutcome.fileReport.invalidRows).toBe(0);
    assertRowsMatchSchema("programs", buildProgramRows(programmesOutcome.validProgrammes));
  });

  it("sources.csv -> public.sources", () => {
    expect(sourcesOutcome.fileReport.invalidRows).toBe(0);
    assertRowsMatchSchema("sources", buildSourceRows(sourcesOutcome.validSources));
  });

  it("exposure.csv -> public.exposure", () => {
    expect(exposureOutcome.fileReport.invalidRows).toBe(0);
    assertRowsMatchSchema(
      "exposure",
      buildExposureRows(exposureOutcome.validExposures, occupationsOutcome.validOccupations)
    );
  });

  it("every data/exposure.csv row matches exactly one data/occupations.csv row, so occupation_id is never null", () => {
    const rows = buildExposureRows(exposureOutcome.validExposures, occupationsOutcome.validOccupations);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.occupation_id, `no unique occupations.csv match for "${row.occupation}" (code "${row.code}")`).not.toBeNull();
    }
  });

  it("every data/exposure.csv source_name is a name built into data/sources.csv's rows", () => {
    const sourceNames = new Set(buildSourceRows(sourcesOutcome.validSources).map((row) => row.name));
    const exposureRows = buildExposureRows(exposureOutcome.validExposures, occupationsOutcome.validOccupations);
    expect(exposureRows.length).toBeGreaterThan(0);
    for (const row of exposureRows) {
      expect(sourceNames.has(row.source_name as string), `"${row.source_name}" is not a name in data/sources.csv`).toBe(
        true
      );
    }
  });

  it("derived skills (from courses.csv + keywords.csv) -> public.skills", () => {
    expect(skills.length).toBeGreaterThan(0);
    // No existing ids in this test, so every skill goes through the "new
    // skill" path, which seeds label_ms / is_green / base_importance (NOT
    // NULL, no default) with placeholders — see buildSkillRows.
    const { existingRows, newRows } = buildSkillRows(skills, new Set(), emptyEmbeddings);
    expect(existingRows).toEqual([]);
    assertRowsMatchSchema("skills", newRows);
  });

  it("certificate is a boolean, and every course skill_id is a built skill row id", () => {
    const { newRows: skillRows } = buildSkillRows(skills, new Set(), emptyEmbeddings);
    const skillIds = new Set(skillRows.map((row) => row.id));
    const courseRows = buildCourseRows(coursesOutcome.validCourses);

    expect(courseRows.length).toBeGreaterThan(0);
    for (const row of courseRows) {
      expect(typeof row.certificate).toBe("boolean");
      for (const skillId of row.skill_ids as string[]) {
        expect(skillIds.has(skillId), `course skill_id "${skillId}" has no matching built skill row`).toBe(true);
      }
    }
  });

  it("keywords.csv -> public.signals, summed on (skill_id, source, metric, window_end)", () => {
    const text = readFileSync(`${DATA_DIR}/keywords.csv`, "utf8");
    const { header, rows } = parseCsv(text);
    const inputs = rows.map((row, index) => ({
      row: index + 2,
      raw: Object.fromEntries(header.map((column, i) => [column, row[i] ?? ""])),
    }));

    const { rows: signalRows, warnings } = buildSignalRows(inputs);

    // data/keywords.csv has no blank checked_on/count cells, so every
    // collision is summed into one row instead of being reported.
    expect(warnings).toHaveLength(0);

    const keys = signalRows.map((row) => `${row.skill_id}|${row.source}|${row.metric}|${row.window_end}`);
    expect(new Set(keys).size).toBe(keys.length);

    for (const row of signalRows) {
      expect(row.keywords.length).toBeGreaterThan(0);
    }

    // signals.id is GENERATED ALWAYS AS IDENTITY: this importer must never set it.
    assertRowsMatchSchema("signals", signalRows);
    for (const row of signalRows) {
      expect(row).not.toHaveProperty("id");
    }
  });

  it("'perform data analysis' sums all four contributing keywords' counts into two rows (current + preceding window)", () => {
    const text = readFileSync(`${DATA_DIR}/keywords.csv`, "utf8");
    const { header, rows } = parseCsv(text);
    const inputs = rows.map((row, index) => ({
      row: index + 2,
      raw: Object.fromEntries(header.map((column, i) => [column, row[i] ?? ""])),
    }));

    const skillId = "2b92a5b2-6758-4ee3-9fb4-b6387a55cc8f";
    const { rows: signalRows, warnings } = buildSignalRows(inputs);
    expect(warnings).toHaveLength(0);

    const skillRows = signalRows.filter((row) => row.skill_id === skillId);
    expect(skillRows).toHaveLength(2);

    const current = skillRows.find((row) => row.window_end === "2026-10-19");
    const preceding = skillRows.find((row) => row.window_end !== "2026-10-19");

    const keywords = ["sentiment analysis", "synthetic data", "anomaly detection", "time series forecasting"];
    const arxivQueries = [
      '"sentiment analysis"',
      '"synthetic data generation"',
      '"anomaly detection"',
      '"time series forecasting"',
    ];

    // Counts from scripts/fetch-arxiv.ts --as-of 2026-10-19.
    expect(current).toMatchObject({
      value: 69 + 115 + 423 + 216,
      window_start: "2026-07-22",
      as_of: "2026-10-19",
      keywords,
      url: arxivQueryUrl(arxivQueries),
    });
    expect(preceding).toMatchObject({
      value: 102 + 132 + 424 + 200,
      window_start: "2026-04-23",
      window_end: "2026-07-21",
      as_of: "2026-10-19",
      keywords,
      url: arxivQueryUrl(arxivQueries),
    });
  });

  it("buildSignalRows sums a same-skill, same-window collision within a batch, recording every contributing keyword, with no warnings", () => {
    const uri = "https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000001";
    const inputs = [
      {
        row: 2,
        raw: {
          keyword: "alpha",
          checked_on: "2026-10-19",
          count_last_90d: "10",
          count_prev_90d: "5",
          arxiv_query: "a",
          skill_uris: uri,
        },
      },
      {
        row: 3,
        raw: {
          keyword: "beta",
          checked_on: "2026-10-19",
          count_last_90d: "20",
          count_prev_90d: "8",
          arxiv_query: "b",
          skill_uris: uri,
        },
      },
    ];

    const { rows, warnings } = buildSignalRows(inputs);

    expect(warnings).toHaveLength(0);
    expect(rows).toHaveLength(2);

    const current = rows.find((row) => row.window_end === "2026-10-19") as (typeof rows)[number];
    const preceding = rows.find((row) => row.window_end !== "2026-10-19") as (typeof rows)[number];

    expect(current.value).toBe(30);
    expect(current.keywords).toEqual(["alpha", "beta"]);
    expect(current.url).toBe(arxivQueryUrl(["a", "b"]));

    expect(preceding.value).toBe(13);
    expect(preceding.keywords).toEqual(["alpha", "beta"]);
  });

  it("applyImport's signals upsert onConflict matches signals_reading_key's columns", () => {
    expect(SIGNALS_ON_CONFLICT).toBe("skill_id,source,metric,window_end");
  });
});

describe("data/occupation_skills.csv (ESCO) feeds scoring", () => {
  const occupationSkillRows = buildOccupationSkillRows(occupationSkillsOutcome.validOccupationSkills);
  const allSkills = deriveSkills([
    ...coursesOutcome.skillPairs,
    ...keywordsOutcome.skillPairs,
    ...occupationSkillsOutcome.skillPairs,
  ]);

  it("occupation_skills.csv -> public.occupation_skills", () => {
    expect(occupationSkillsOutcome.fileReport.invalidRows).toBe(0);
    assertRowsMatchSchema("occupation_skills", occupationSkillRows);
  });

  it("every occupation in occupations.csv has at least 5 essential skills (T14 done-when)", () => {
    for (const occupation of occupationsOutcome.validOccupations) {
      const essential = occupationSkillRows.filter(
        (row) => row.occupation_id === occupation.id && row.relation === "essential"
      );
      expect(essential.length, `${occupation.id} ${occupation.titleEn}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("every occupation_skills skill_id is a built skill row id, so the foreign key holds", () => {
    const { newRows } = buildSkillRows(allSkills, new Set(), emptyEmbeddings);
    const skillIds = new Set(newRows.map((row) => row.id));
    const missing = occupationSkillRows.filter((row) => !skillIds.has(row.skill_id as string));
    expect(missing).toEqual([]);
  });

  it("data/occupation_skills.csv is unique on (occupation_id, skill_id), matching the primary key", () => {
    const keys = occupationSkillRows.map((row) => `${row.occupation_id}|${row.skill_id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("data/*.csv respects the primary keys the migrations declare", () => {
  it("data/exposure.csv is unique on (occupation, source_name), matching public.exposure's primary key", () => {
    const text = readFileSync(`${DATA_DIR}/exposure.csv`, "utf8");
    const { header, rows } = parseCsv(text);
    const occupationIndex = header.indexOf("occupation");
    const sourceNameIndex = header.indexOf("source_name");

    const keys = rows.map((row) => `${row[occupationIndex]}|${row[sourceNameIndex]}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("data/sources.csv is unique on name, matching public.sources's primary key", () => {
    const text = readFileSync(`${DATA_DIR}/sources.csv`, "utf8");
    const { header, rows } = parseCsv(text);
    const nameIndex = header.indexOf("name");

    const names = rows.map((row) => row[nameIndex]);
    expect(new Set(names).size).toBe(names.length);
  });
});

// public.cluster_demand is not in live-schema.json: its migration
// (20261022090000) has not been applied to the live project yet.
describe("data/demand.csv + data/scenarios.csv -> public.scenarios", () => {
  const rows = buildScenarioRows(
    scenariosOutcome.validScenarios,
    demandOutcome.validDemand,
    occupationsOutcome.validOccupations
  );

  it("both files are clean", () => {
    expect(demandOutcome.fileReport.invalidRows).toBe(0);
    expect(scenariosOutcome.fileReport.invalidRows).toBe(0);
  });

  it("builds rows that match the live public.scenarios columns", () => {
    assertRowsMatchSchema("scenarios", rows);
  });

  it("gives every cluster in occupations.csv a demand between 0 and 1 in all three scenarios", () => {
    const clusters = new Set(occupationsOutcome.validOccupations.map((occupation) => occupation.cluster));
    expect(rows.map((row) => row.id)).toEqual(["co", "dis", "sup"]);
    for (const row of rows) {
      const demand = row.demand_by_cluster as Record<string, number>;
      for (const cluster of clusters) {
        expect(demand[cluster], `${row.id} ${cluster}`).toBeGreaterThan(0);
        expect(demand[cluster]).toBeLessThanOrEqual(1);
      }
    }
  });
});
