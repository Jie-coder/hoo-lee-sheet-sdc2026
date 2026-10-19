// Validates data/*.csv against the Laluan contracts, and with --apply,
// upserts the valid rows into Supabase (computing Gemini embeddings for
// occupations and skills). Default is always a dry run: see data/README.md
// for how Tiffany and Henry should use this day to day.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./lib/csv";
import { diffHeaders, FILE_SPECS, resolveOnly, type FileKey } from "./lib/files";
import {
  mapCourseRow,
  mapExposureRow,
  mapKeywordRow,
  mapOccupationRow,
  mapProgrammeRow,
  mapSourceRow,
} from "./lib/mappers";
import { runCrossChecks, type CrossCheckInput } from "./lib/cross-checks";
import { exitCodeFor, formatReport, type FileReport, type FullReport, type Issue } from "./lib/report";
import { readEnvLocal, requireApplyEnv, type ApplyEnv } from "./lib/env";
import { createEmbedderFor, createSupabaseClientFor, type Embedder } from "./lib/clients";
import { applyImport, type ApplyInput, type ApplyResult, type SkillRecord } from "./lib/apply";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Programme } from "../src/types/contracts";
import type { OccupationRow } from "./lib/row-schemas";

export type RunOptions = {
  dir: string;
  only?: string;
  apply: boolean;
  env: Record<string, string | undefined>;
  createSupabaseClient?: (env: ApplyEnv) => SupabaseClient;
  createEmbedder?: (env: ApplyEnv) => Embedder;
};

export type RunResult = {
  report: FullReport;
  exitCode: number;
  argError?: string;
  applyError?: string;
  applyResult?: ApplyResult;
};

type FileRunOutcome = {
  fileReport: FileReport;
  cross: Partial<CrossCheckInput>;
  validCourses: Course[];
  validProgrammes: Programme[];
  validOccupations: OccupationRow[];
  skillPairs: { skills: string[]; skillUris: string[] }[];
};

function zipHeader(header: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  header.forEach((column, index) => {
    record[column] = row[index] ?? "";
  });
  return record;
}

function runFile(key: FileKey, dir: string): FileRunOutcome {
  const spec = FILE_SPECS[key];
  const path = join(dir, spec.filename);

  const empty: FileRunOutcome = {
    fileReport: {
      file: spec.filename,
      present: false,
      note: "not found, skipped",
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: [],
    },
    cross: {},
    validCourses: [],
    validProgrammes: [],
    validOccupations: [],
    skillPairs: [],
  };

  if (!existsSync(path)) return empty;

  const text = readFileSync(path, "utf8");
  const { header, rows } = parseCsv(text);

  const issues: Issue[] = [];
  const { missing, unexpected } = diffHeaders(spec.headers, header);
  for (const column of missing) {
    issues.push({
      file: spec.filename,
      column,
      message: `missing required column "${column}"`,
      hint: `add a "${column}" column (see data/README.md)`,
      severity: "error",
    });
  }
  for (const column of unexpected) {
    issues.push({
      file: spec.filename,
      column,
      message: `unexpected column "${column}"`,
      hint: "remove it, or check data/README.md for the expected columns",
      severity: "error",
    });
  }

  let validRows = 0;
  let invalidRows = 0;
  const validCourses: Course[] = [];
  const validProgrammes: Programme[] = [];
  const validOccupations: OccupationRow[] = [];
  const skillPairs: { skills: string[]; skillUris: string[] }[] = [];
  const courseCross: { row: number; id: string; skills: string[]; skillUris: string[] }[] = [];
  const programmeCross: { row: number; id: string }[] = [];
  const sourceCross: { row: number; name: string }[] = [];
  const keywordCross: { row: number; keyword: string; skills: string[]; skillUris: string[] }[] = [];
  const exposureCross: { row: number; occupation: string; code: string; sourceName: string }[] = [];
  const occupationCross: {
    row: number;
    id: string;
    escoUri: string | null;
    iscoCode: string | null;
    titleEn: string;
  }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = zipHeader(header, row);

    if (key === "courses") {
      const result = mapCourseRow(raw, rowNumber);
      issues.push(...result.issues);
      courseCross.push({ row: rowNumber, id: raw.id ?? "", skills: result.skills, skillUris: result.skillUris });
      if (result.value) {
        validCourses.push(result.value);
        skillPairs.push({ skills: result.skills, skillUris: result.skillUris });
      }
      if (result.value) validRows++;
      else invalidRows++;
    } else if (key === "programmes") {
      const result = mapProgrammeRow(raw, rowNumber);
      issues.push(...result.issues);
      programmeCross.push({ row: rowNumber, id: raw.id ?? "" });
      if (result.value) validProgrammes.push(result.value);
      if (result.value) validRows++;
      else invalidRows++;
    } else if (key === "sources") {
      const result = mapSourceRow(raw, rowNumber);
      issues.push(...result.issues);
      sourceCross.push({ row: rowNumber, name: raw.name ?? "" });
      if (result.value) validRows++;
      else invalidRows++;
    } else if (key === "keywords") {
      const result = mapKeywordRow(raw, rowNumber);
      issues.push(...result.issues, ...result.warnings);
      keywordCross.push({
        row: rowNumber,
        keyword: raw.keyword ?? "",
        skills: result.skills,
        skillUris: result.skillUris,
      });
      if (result.value) skillPairs.push({ skills: result.skills, skillUris: result.skillUris });
      if (result.value) validRows++;
      else invalidRows++;
    } else if (key === "exposure") {
      const result = mapExposureRow(raw, rowNumber);
      issues.push(...result.issues);
      exposureCross.push({
        row: rowNumber,
        occupation: raw.occupation ?? "",
        code: raw.code ?? "",
        sourceName: raw.source_name ?? "",
      });
      if (result.value) validRows++;
      else invalidRows++;
    } else if (key === "occupations") {
      const result = mapOccupationRow(raw, rowNumber);
      issues.push(...result.issues);
      occupationCross.push({
        row: rowNumber,
        id: raw.id ?? "",
        escoUri: isBlankCell(raw.esco_uri) ? null : raw.esco_uri ?? null,
        iscoCode: isBlankCell(raw.isco_code) ? null : raw.isco_code ?? null,
        titleEn: raw.title_en ?? "",
      });
      if (result.value) validOccupations.push(result.value);
      if (result.value) validRows++;
      else invalidRows++;
    }
  });

  return {
    fileReport: {
      file: spec.filename,
      present: true,
      totalRows: rows.length,
      validRows,
      invalidRows,
      issues,
    },
    cross:
      key === "courses"
        ? { courses: courseCross }
        : key === "programmes"
          ? { programmes: programmeCross }
          : key === "sources"
            ? { sources: sourceCross }
            : key === "keywords"
              ? { keywords: keywordCross }
              : key === "exposure"
                ? { exposure: exposureCross }
                : { occupations: occupationCross },
    validCourses,
    validProgrammes,
    validOccupations,
    skillPairs,
  };
}

function isBlankCell(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

function deriveSkills(skillPairs: { skills: string[]; skillUris: string[] }[]): SkillRecord[] {
  const byId = new Map<string, SkillRecord>();
  for (const { skills, skillUris } of skillPairs) {
    const count = Math.min(skills.length, skillUris.length);
    for (let i = 0; i < count; i += 1) {
      const uri = skillUris[i];
      const id = uri.split("/").pop()?.toLowerCase() ?? uri;
      if (!byId.has(id)) byId.set(id, { id, escoUri: uri, labelEn: skills[i] });
    }
  }
  return Array.from(byId.values());
}

export async function runImport(options: RunOptions): Promise<RunResult> {
  const only = resolveOnly(options.only);
  if (!only.ok) {
    return {
      report: { files: [], crossFileIssues: [] },
      exitCode: 1,
      argError: only.error,
    };
  }

  const outcomes = only.keys.map((key) => ({ key, outcome: runFile(key, options.dir) }));

  const crossInput: CrossCheckInput = {};
  for (const { outcome } of outcomes) Object.assign(crossInput, outcome.cross);
  const crossFileIssues = runCrossChecks(crossInput);

  const report: FullReport = {
    files: outcomes.map(({ outcome }) => outcome.fileReport),
    crossFileIssues,
  };

  const exitCode = exitCodeFor(report);
  const result: RunResult = { report, exitCode };

  if (!options.apply) return result;

  if (exitCode !== 0) {
    result.applyError = "refusing to apply: fix the validation errors above first";
    return result;
  }

  const envResult = requireApplyEnv(options.env);
  if (!envResult.ok) {
    result.applyError = `missing required environment variable(s): ${envResult.missing.join(", ")}`;
    return result;
  }

  const createSupabaseClient = options.createSupabaseClient ?? createSupabaseClientFor;
  const createEmbedder = options.createEmbedder ?? createEmbedderFor;
  const supabase = createSupabaseClient(envResult.env);
  const embedder = createEmbedder(envResult.env);

  const applyInput: ApplyInput = {
    courses: outcomes.flatMap(({ outcome }) => outcome.validCourses),
    programmes: outcomes.flatMap(({ outcome }) => outcome.validProgrammes),
    occupations: outcomes.flatMap(({ outcome }) => outcome.validOccupations),
    skills: deriveSkills(outcomes.flatMap(({ outcome }) => outcome.skillPairs)),
  };

  result.applyResult = await applyImport(applyInput, supabase, embedder);
  return result;
}

function parseArgs(argv: string[]): { dir: string; only?: string; apply: boolean } {
  let dir = "data";
  let only: string | undefined;
  let apply = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--dir") {
      dir = argv[i + 1] ?? dir;
      i += 1;
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length);
    } else if (arg === "--only") {
      only = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--only=")) {
      only = arg.slice("--only=".length);
    }
  }

  return { dir, only, apply };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = args.apply ? { ...process.env, ...readEnvLocal(process.cwd()) } : process.env;

  const result = await runImport({ dir: args.dir, only: args.only, apply: args.apply, env });

  if (result.argError) {
    console.error(result.argError);
    process.exit(1);
  }

  console.log(formatReport(result.report));

  if (args.apply) {
    if (result.applyError) {
      console.error(`\napply: ${result.applyError}`);
      process.exit(1);
    }
    if (result.applyResult) {
      console.log("\napply:");
      for (const table of result.applyResult.tables) {
        console.log(
          table.error
            ? `  ${table.table}: FAILED — ${table.error}`
            : `  ${table.table}: upserted ${table.upserted} row(s)`
        );
      }
      for (const skipped of result.applyResult.skipped) {
        console.log(`  ${skipped.file}: skipped — ${skipped.reason}`);
      }
      const failed = result.applyResult.tables.some((table) => table.error);
      if (failed) process.exit(1);
    }
  }

  process.exit(result.exitCode);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
