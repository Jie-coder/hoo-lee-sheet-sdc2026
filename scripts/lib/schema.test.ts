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
  buildCourseRows,
  buildOccupationRows,
  buildProgramRows,
  buildSignalRows,
  buildSkillRows,
  SIGNALS_ON_CONFLICT,
} from "./apply";
import { splitNames } from "./cells";
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

  it("keywords.csv -> public.signals, deduped on (skill_id, source, metric, window_end)", () => {
    const text = readFileSync(`${DATA_DIR}/keywords.csv`, "utf8");
    const { header, rows } = parseCsv(text);
    const inputs = rows.map((row, index) => ({
      row: index + 2,
      raw: Object.fromEntries(header.map((column, i) => [column, row[i] ?? ""])),
    }));

    const totalSkillUriRefs = inputs.reduce(
      (total, { raw }) => total + splitNames(raw.skill_uris ?? "").length,
      0
    );

    const { rows: signalRows, warnings } = buildSignalRows(inputs);

    // Two rows (current + preceding window) are built per skill URI
    // reference before dedupe; every one not kept must be reported instead.
    expect(signalRows.length + warnings.length).toBe(totalSkillUriRefs * 2);
    expect(warnings.every((issue) => issue.severity === "warning")).toBe(true);

    const keys = signalRows.map((row) => `${row.skill_id}|${row.source}|${row.metric}|${row.window_end}`);
    expect(new Set(keys).size).toBe(keys.length);

    // signals.id is GENERATED ALWAYS AS IDENTITY: this importer must never set it.
    assertRowsMatchSchema("signals", signalRows);
    for (const row of signalRows) {
      expect(row).not.toHaveProperty("id");
    }
  });

  it("buildSignalRows dedupes a same-skill, same-window collision within a batch, keeping the first row and warning on the rest", () => {
    const uri = "https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000001";
    const inputs = [
      {
        row: 2,
        raw: { checked_on: "2026-10-19", count_last_90d: "10", count_prev_90d: "5", arxiv_query: "a", skill_uris: uri },
      },
      {
        row: 3,
        raw: { checked_on: "2026-10-19", count_last_90d: "20", count_prev_90d: "8", arxiv_query: "b", skill_uris: uri },
      },
    ];

    const { rows, warnings } = buildSignalRows(inputs);

    // Only row 2's current + preceding-window readings survive.
    expect(rows.map((row) => row.value).sort((a, b) => a - b)).toEqual([5, 10]);
    expect(warnings).toHaveLength(2);
    for (const warning of warnings) {
      expect(warning).toMatchObject({ file: "keywords.csv", row: 3, severity: "warning" });
      expect(warning.message).toMatch(/already produced by row 2/);
    }
  });

  it("applyImport's signals upsert onConflict matches signals_reading_key's columns", () => {
    expect(SIGNALS_ON_CONFLICT).toBe("skill_id,source,metric,window_end");
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
