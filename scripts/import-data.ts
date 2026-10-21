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
import { duplicateIssues, runCrossChecks, type CrossCheckInput } from "./lib/cross-checks";
import { exitCodeFor, formatReport, type FileReport, type FullReport, type Issue } from "./lib/report";
import { ENV_LOCAL_MISSING_MESSAGE, readEnvLocal, requireApplyEnv, type ApplyEnv } from "./lib/env";
import {
  applyImport,
  buildSignalRows,
  type ApplyInput,
  type ApplyResult,
  type SignalRow,
  type SignalRowInput,
  type SkillRecord,
} from "./lib/apply";
// Type-only: must not pull in @supabase/supabase-js or @ai-sdk/google at
// runtime just for a dry run. The real module is loaded with a dynamic
// import() below, only once --apply has actually been requested.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Embedder } from "./lib/clients";
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

export type FileRunOutcome = {
  fileReport: FileReport;
  cross: Partial<CrossCheckInput>;
  validCourses: Course[];
  validProgrammes: Programme[];
  validOccupations: OccupationRow[];
  skillPairs: { skills: string[]; skillUris: string[] }[];
  signalRows: SignalRow[];
};

function zipHeader(header: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  header.forEach((column, index) => {
    record[column] = row[index] ?? "";
  });
  return record;
}

/**
 * Runs the within-file duplicate-key check, and returns which rows to keep
 * (the earlier occurrence of each key) along with the recount of valid vs.
 * invalid rows: a later duplicate counts as invalid even if it otherwise
 * parsed cleanly.
 */
function finalizeDuplicates<T extends { row: number; valid: boolean }>(
  file: string,
  column: string,
  dedupeKey: (record: T) => string,
  records: T[]
): { issues: Issue[]; validRows: number; invalidRows: number; kept: T[] } {
  const dupIssues = duplicateIssues(
    file,
    column,
    records.map((record) => ({ row: record.row, key: dedupeKey(record) }))
  );
  const dupRows = new Set(dupIssues.map((issue) => issue.row as number));
  const kept = records.filter((record) => !dupRows.has(record.row));
  const validRows = kept.filter((record) => record.valid).length;
  return { issues: dupIssues, validRows, invalidRows: records.length - validRows, kept };
}

type CourseRecord = {
  row: number;
  id: string;
  valid: boolean;
  value: Course | null;
  skills: string[];
  skillUris: string[];
};
type ProgrammeRecord = { row: number; id: string; valid: boolean; value: Programme | null };
type SourceRecord = { row: number; name: string; valid: boolean };
type KeywordRecord = {
  row: number;
  keyword: string;
  valid: boolean;
  skills: string[];
  skillUris: string[];
  raw: Record<string, string>;
};
type OccupationRecord = {
  row: number;
  id: string;
  valid: boolean;
  value: OccupationRow | null;
  escoUri: string | null;
  iscoCode: string | null;
  titleEn: string;
};

export function runFile(key: FileKey, dir: string): FileRunOutcome {
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
    signalRows: [],
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

  const courseRecords: CourseRecord[] = [];
  const programmeRecords: ProgrammeRecord[] = [];
  const sourceRecords: SourceRecord[] = [];
  const keywordRecords: KeywordRecord[] = [];
  const exposureCross: { row: number; occupation: string; code: string; sourceName: string }[] = [];
  let exposureValidRows = 0;
  const occupationRecords: OccupationRecord[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = zipHeader(header, row);

    if (key === "courses") {
      const result = mapCourseRow(raw, rowNumber);
      issues.push(...result.issues);
      courseRecords.push({
        row: rowNumber,
        id: raw.id ?? "",
        valid: result.value !== null,
        value: result.value,
        skills: result.skills,
        skillUris: result.skillUris,
      });
    } else if (key === "programmes") {
      const result = mapProgrammeRow(raw, rowNumber);
      issues.push(...result.issues);
      programmeRecords.push({
        row: rowNumber,
        id: raw.id ?? "",
        valid: result.value !== null,
        value: result.value,
      });
    } else if (key === "sources") {
      const result = mapSourceRow(raw, rowNumber);
      issues.push(...result.issues);
      sourceRecords.push({ row: rowNumber, name: raw.name ?? "", valid: result.value !== null });
    } else if (key === "keywords") {
      const result = mapKeywordRow(raw, rowNumber);
      issues.push(...result.issues, ...result.warnings);
      keywordRecords.push({
        row: rowNumber,
        keyword: raw.keyword ?? "",
        valid: result.value !== null,
        skills: result.skills,
        skillUris: result.skillUris,
        raw,
      });
    } else if (key === "exposure") {
      const result = mapExposureRow(raw, rowNumber);
      issues.push(...result.issues);
      exposureCross.push({
        row: rowNumber,
        occupation: raw.occupation ?? "",
        code: raw.code ?? "",
        sourceName: raw.source_name ?? "",
      });
      if (result.value) exposureValidRows += 1;
    } else if (key === "occupations") {
      const result = mapOccupationRow(raw, rowNumber);
      issues.push(...result.issues);
      occupationRecords.push({
        row: rowNumber,
        id: raw.id ?? "",
        valid: result.value !== null,
        value: result.value,
        escoUri: isBlankCell(raw.esco_uri) ? null : raw.esco_uri ?? null,
        iscoCode: isBlankCell(raw.isco_code) ? null : raw.isco_code ?? null,
        titleEn: raw.title_en ?? "",
      });
    }
  });

  let validRows = 0;
  let invalidRows = 0;
  let validCourses: Course[] = [];
  let validProgrammes: Programme[] = [];
  let validOccupations: OccupationRow[] = [];
  let skillPairs: { skills: string[]; skillUris: string[] }[] = [];
  let signalRows: SignalRow[] = [];
  let cross: Partial<CrossCheckInput> = {};

  if (key === "courses") {
    const dup = finalizeDuplicates("courses.csv", "id", (r) => r.id, courseRecords);
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    validCourses = dup.kept.filter((r) => r.value).map((r) => r.value as Course);
    skillPairs = dup.kept
      .filter((r) => r.value)
      .map((r) => ({ skills: r.skills, skillUris: r.skillUris }));
    cross = {
      courses: courseRecords.map((r) => ({ row: r.row, id: r.id, skills: r.skills, skillUris: r.skillUris })),
    };
  } else if (key === "programmes") {
    const dup = finalizeDuplicates("programmes.csv", "id", (r) => r.id, programmeRecords);
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    validProgrammes = dup.kept.filter((r) => r.value).map((r) => r.value as Programme);
  } else if (key === "sources") {
    const dup = finalizeDuplicates("sources.csv", "name", (r) => r.name, sourceRecords);
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    cross = { sources: sourceRecords.map((r) => ({ row: r.row, name: r.name })) };
  } else if (key === "keywords") {
    const dup = finalizeDuplicates("keywords.csv", "keyword", (r) => r.keyword, keywordRecords);
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    const validKeywordRecords = dup.kept.filter((r) => r.valid);
    skillPairs = validKeywordRecords.map((r) => ({ skills: r.skills, skillUris: r.skillUris }));
    const signalInputs: SignalRowInput[] = validKeywordRecords.map((r) => ({ row: r.row, raw: r.raw }));
    const signalsResult = buildSignalRows(signalInputs);
    issues.push(...signalsResult.warnings);
    signalRows = signalsResult.rows;
    cross = {
      keywords: keywordRecords.map((r) => ({
        row: r.row,
        keyword: r.keyword,
        skills: r.skills,
        skillUris: r.skillUris,
      })),
    };
  } else if (key === "exposure") {
    // exposure.csv has no id-like column that must be unique: the same
    // occupation can legitimately appear with figures from several sources.
    validRows = exposureValidRows;
    invalidRows = rows.length - validRows;
    cross = { exposure: exposureCross };
  } else {
    const dup = finalizeDuplicates("occupations.csv", "id", (r) => r.id, occupationRecords);
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    validOccupations = dup.kept.filter((r) => r.value).map((r) => r.value as OccupationRow);
    cross = {
      occupations: occupationRecords.map((r) => ({
        row: r.row,
        id: r.id,
        escoUri: r.escoUri,
        iscoCode: r.iscoCode,
        titleEn: r.titleEn,
      })),
    };
  }

  return {
    fileReport: {
      file: spec.filename,
      present: true,
      totalRows: rows.length,
      validRows,
      invalidRows,
      issues,
    },
    cross,
    validCourses,
    validProgrammes,
    validOccupations,
    skillPairs,
    signalRows,
  };
}

function isBlankCell(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

export function deriveSkills(skillPairs: { skills: string[]; skillUris: string[] }[]): SkillRecord[] {
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

  let createSupabaseClient = options.createSupabaseClient;
  let createEmbedder = options.createEmbedder;
  if (!createSupabaseClient || !createEmbedder) {
    // Deferred so a dry run never pulls in @supabase/supabase-js or the
    // Gemini SDK (and never prints their startup warnings).
    const clients = await import("./lib/clients");
    createSupabaseClient = createSupabaseClient ?? clients.createSupabaseClientFor;
    createEmbedder = createEmbedder ?? clients.createEmbedderFor;
  }
  const supabase = createSupabaseClient(envResult.env);
  const embedder = createEmbedder(envResult.env);

  const applyInput: ApplyInput = {
    courses: outcomes.flatMap(({ outcome }) => outcome.validCourses),
    programmes: outcomes.flatMap(({ outcome }) => outcome.validProgrammes),
    occupations: outcomes.flatMap(({ outcome }) => outcome.validOccupations),
    skills: deriveSkills(outcomes.flatMap(({ outcome }) => outcome.skillPairs)),
    signals: outcomes.flatMap(({ outcome }) => outcome.signalRows),
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

export type CliOutput = { stdout: string[]; stderr: string[]; exitCode: number };

/**
 * The CLI's logic with all I/O factored out: takes argv and a cwd, returns
 * what to print and the exit code, so it is testable without a subprocess.
 * --apply reads secrets only from <cwd>/.env.local, never from process.env,
 * so ambient shell exports (e.g. a key exported for another project) can
 * never be used silently.
 */
export async function runCli(
  argv: string[],
  cwd: string,
  overrides?: {
    createSupabaseClient?: (env: ApplyEnv) => SupabaseClient;
    createEmbedder?: (env: ApplyEnv) => Embedder;
  }
): Promise<CliOutput> {
  const args = parseArgs(argv);
  const stdout: string[] = [];
  const stderr: string[] = [];

  let env: Record<string, string | undefined> = process.env;
  let envLocalMissing = false;
  if (args.apply) {
    const envLocal = readEnvLocal(cwd);
    env = envLocal.vars;
    envLocalMissing = !envLocal.exists;
  }

  const result = await runImport({
    dir: args.dir,
    only: args.only,
    apply: args.apply,
    env,
    createSupabaseClient: overrides?.createSupabaseClient,
    createEmbedder: overrides?.createEmbedder,
  });

  if (result.argError) {
    stderr.push(result.argError);
    return { stdout, stderr, exitCode: 1 };
  }

  stdout.push(formatReport(result.report));

  if (args.apply) {
    if (envLocalMissing) {
      stderr.push(`\napply: ${ENV_LOCAL_MISSING_MESSAGE}`);
      return { stdout, stderr, exitCode: 1 };
    }
    if (result.applyError) {
      stderr.push(`\napply: ${result.applyError}`);
      return { stdout, stderr, exitCode: 1 };
    }
    if (result.applyResult) {
      const applyLines = ["\napply:"];
      for (const table of result.applyResult.tables) {
        applyLines.push(
          table.error
            ? `  ${table.table}: FAILED — ${table.error}`
            : `  ${table.table}: upserted ${table.upserted} row(s)`
        );
      }
      for (const skipped of result.applyResult.skipped) {
        applyLines.push(`  ${skipped.file}: skipped — ${skipped.reason}`);
      }
      stdout.push(applyLines.join("\n"));
      const failed = result.applyResult.tables.some((table) => table.error);
      if (failed) return { stdout, stderr, exitCode: 1 };
    }
  }

  return { stdout, stderr, exitCode: result.exitCode };
}

async function main() {
  const { stdout, stderr, exitCode } = await runCli(process.argv.slice(2), process.cwd());
  for (const line of stdout) console.log(line);
  for (const line of stderr) console.error(line);
  process.exit(exitCode);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
