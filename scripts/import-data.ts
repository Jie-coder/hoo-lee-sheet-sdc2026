// Validates data/*.csv against the Laluan contracts, and with --apply,
// upserts the valid rows into Supabase (computing Gemini embeddings for
// occupations and skills). Default is always a dry run: see data/README.md
// for how Tiffany and Henry should use this day to day.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./lib/csv";
import { diffHeaders, FILE_SPECS, resolveOnly, type FileKey } from "./lib/files";
import {
  mapCourseRow,
  mapDemandRow,
  mapExposureRow,
  mapKeywordRow,
  mapOccupationRow,
  mapOccupationSkillRow,
  mapProgrammeRow,
  mapScenarioRow,
  mapSourceRow,
} from "./lib/mappers";
import {
  duplicateIssues,
  runCrossChecks,
  scenarioThetaIssues,
  type CrossCheckInput,
} from "./lib/cross-checks";
import { exitCodeFor, formatReport, type FileReport, type FullReport, type Issue } from "./lib/report";
import { ENV_LOCAL_MISSING_MESSAGE, readEnvLocal, requireApplyEnv, type ApplyEnv } from "./lib/env";
import {
  applyImport,
  buildSignalRows,
  computeWouldWriteCounts,
  WOULD_WRITE_TABLES,
  type ApplyInput,
  type ApplyResult,
  type SignalRow,
  type SignalRowInput,
  type SkillRecord,
  type WouldWriteCounts,
} from "./lib/apply";
// Type-only: must not pull in @supabase/supabase-js or @ai-sdk/google at
// runtime just for a dry run. The real module is loaded with a dynamic
// import() below, only once --apply has actually been requested.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Embedder } from "./lib/clients";
import type { Course, Programme } from "../src/types/contracts";
import type {
  DemandRow,
  ExposureRow,
  OccupationRow,
  OccupationSkillRow,
  ScenarioRow,
  SourceRow,
} from "./lib/row-schemas";

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
  wouldWrite?: WouldWriteCounts;
};

export type FileRunOutcome = {
  fileReport: FileReport;
  cross: Partial<CrossCheckInput>;
  validCourses: Course[];
  validProgrammes: Programme[];
  validOccupations: OccupationRow[];
  validSources: SourceRow[];
  validExposures: ExposureRow[];
  validOccupationSkills: OccupationSkillRow[];
  validDemand: DemandRow[];
  validScenarios: ScenarioRow[];
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
type SourceRecord = { row: number; name: string; valid: boolean; value: SourceRow | null };
type ExposureRecord = { row: number; valid: boolean; value: ExposureRow | null };
type KeywordRecord = {
  row: number;
  keyword: string;
  valid: boolean;
  skills: string[];
  skillUris: string[];
  raw: Record<string, string>;
};
type OccupationSkillRecord = {
  row: number;
  /** occupation_id + skill_uri, for the duplicate check. */
  key: string;
  valid: boolean;
  value: OccupationSkillRow | null;
  occupationId: string;
  sourceName: string;
};
type DemandRecord = {
  row: number;
  /** cluster + isco_major_group + metric + period, for the duplicate check. */
  key: string;
  valid: boolean;
  value: DemandRow | null;
  raw: Record<string, string>;
};
type ScenarioRecord = {
  row: number;
  /** scenario_id + cluster, for the duplicate check. */
  key: string;
  valid: boolean;
  value: ScenarioRow | null;
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
    validSources: [],
    validExposures: [],
    validOccupationSkills: [],
    validDemand: [],
    validScenarios: [],
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
  const exposureRecords: ExposureRecord[] = [];
  const occupationRecords: OccupationRecord[] = [];
  const occupationSkillRecords: OccupationSkillRecord[] = [];
  const demandRecords: DemandRecord[] = [];
  const scenarioRecords: ScenarioRecord[] = [];

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
      sourceRecords.push({
        row: rowNumber,
        name: raw.name ?? "",
        valid: result.value !== null,
        value: result.value,
      });
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
      exposureRecords.push({ row: rowNumber, valid: result.value !== null, value: result.value });
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
    } else if (key === "occupation_skills") {
      const result = mapOccupationSkillRow(raw, rowNumber);
      issues.push(...result.issues);
      occupationSkillRecords.push({
        row: rowNumber,
        key: `${(raw.occupation_id ?? "").trim()} ${(raw.skill_uri ?? "").trim()}`,
        valid: result.value !== null,
        value: result.value,
        occupationId: raw.occupation_id ?? "",
        sourceName: raw.source_name ?? "",
      });
    } else if (key === "demand") {
      const result = mapDemandRow(raw, rowNumber);
      issues.push(...result.issues);
      const cells = ["cluster", "isco_major_group", "metric", "period"].map((c) => (raw[c] ?? "").trim());
      demandRecords.push({ row: rowNumber, key: cells.join(" "), valid: result.value !== null, value: result.value, raw });
    } else if (key === "scenarios") {
      const result = mapScenarioRow(raw, rowNumber);
      issues.push(...result.issues);
      const cells = ["scenario_id", "cluster"].map((c) => (raw[c] ?? "").trim());
      scenarioRecords.push({ row: rowNumber, key: cells.join(" "), valid: result.value !== null, value: result.value, raw });
    }
  });

  let validRows = 0;
  let invalidRows = 0;
  let validCourses: Course[] = [];
  let validProgrammes: Programme[] = [];
  let validOccupations: OccupationRow[] = [];
  let validSources: SourceRow[] = [];
  let validExposures: ExposureRow[] = [];
  let validOccupationSkills: OccupationSkillRow[] = [];
  let validDemand: DemandRow[] = [];
  let validScenarios: ScenarioRow[] = [];
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
    validSources = dup.kept.filter((r) => r.value).map((r) => r.value as SourceRow);
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
    validRows = exposureRecords.filter((r) => r.valid).length;
    invalidRows = rows.length - validRows;
    validExposures = exposureRecords.filter((r) => r.value).map((r) => r.value as ExposureRow);
    cross = { exposure: exposureCross };
  } else if (key === "occupation_skills") {
    // One row per (occupation, skill): the same pair twice is a duplicate.
    const dup = finalizeDuplicates(
      "occupation_skills.csv",
      "occupation_id + skill_uri",
      (r) => r.key,
      occupationSkillRecords
    );
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    validOccupationSkills = dup.kept
      .filter((r) => r.value)
      .map((r) => r.value as OccupationSkillRow);
    // Feeds deriveSkills: ESCO skills that no course or keyword mentions
    // still need a public.skills row before occupation_skills can point at them.
    skillPairs = validOccupationSkills.map((r) => ({ skills: [r.skillLabel], skillUris: [r.skillUri] }));
    cross = {
      occupationSkills: occupationSkillRecords.map((r) => ({
        row: r.row,
        occupationId: r.occupationId,
        sourceName: r.sourceName,
      })),
    };
  } else if (key === "demand") {
    // One figure per cluster, major group, metric and period.
    const dup = finalizeDuplicates(
      "demand.csv",
      "cluster + isco_major_group + metric + period",
      (r) => r.key,
      demandRecords
    );
    issues.push(...dup.issues);
    validRows = dup.validRows;
    invalidRows = dup.invalidRows;
    validDemand = dup.kept.filter((r) => r.value).map((r) => r.value as DemandRow);
    cross = {
      demand: demandRecords.map((r) => ({
        row: r.row,
        cluster: (r.raw.cluster ?? "").trim(),
        iscoMajorGroup: (r.raw.isco_major_group ?? "").trim(),
        sourceName: r.raw.source_name ?? "",
      })),
    };
  } else if (key === "scenarios") {
    // One multiplier per scenario and cluster; one theta per scenario.
    const dup = finalizeDuplicates("scenarios.csv", "scenario_id + cluster", (r) => r.key, scenarioRecords);
    const thetaIssues = scenarioThetaIssues(
      dup.kept
        .filter((r) => r.value)
        .map((r) => ({ row: r.row, scenarioId: (r.value as ScenarioRow).scenarioId, theta: (r.value as ScenarioRow).theta }))
    );
    issues.push(...dup.issues, ...thetaIssues);
    const thetaRows = new Set(thetaIssues.map((issue) => issue.row));
    const kept = dup.kept.filter((r) => r.value && !thetaRows.has(r.row));
    validRows = kept.length;
    invalidRows = scenarioRecords.length - validRows;
    validScenarios = kept.map((r) => r.value as ScenarioRow);
    cross = {
      scenarios: scenarioRecords.map((r) => ({
        row: r.row,
        scenarioId: (r.raw.scenario_id ?? "").trim(),
        cluster: (r.raw.cluster ?? "").trim(),
        sourceName: r.raw.source_name ?? "",
      })),
    };
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
      // Valid rows only: an invalid row has no trustworthy cluster.
      occupationClusters: occupationRecords
        .filter((r) => r.value)
        .map((r) => ({ id: r.id, cluster: (r.value as OccupationRow).cluster, iscoCode: r.iscoCode })),
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
    validSources,
    validExposures,
    validOccupationSkills,
    validDemand,
    validScenarios,
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

  // Built from the same validated rows --apply would upsert, so a dry run's
  // row counts (result.wouldWrite) match what --apply actually writes.
  const applyInput: ApplyInput = {
    courses: outcomes.flatMap(({ outcome }) => outcome.validCourses),
    programmes: outcomes.flatMap(({ outcome }) => outcome.validProgrammes),
    occupations: outcomes.flatMap(({ outcome }) => outcome.validOccupations),
    skills: deriveSkills(outcomes.flatMap(({ outcome }) => outcome.skillPairs)),
    signals: outcomes.flatMap(({ outcome }) => outcome.signalRows),
    sources: outcomes.flatMap(({ outcome }) => outcome.validSources),
    exposure: outcomes.flatMap(({ outcome }) => outcome.validExposures),
    occupationSkills: outcomes.flatMap(({ outcome }) => outcome.validOccupationSkills),
    demand: outcomes.flatMap(({ outcome }) => outcome.validDemand),
    scenarios: outcomes.flatMap(({ outcome }) => outcome.validScenarios),
  };
  result.wouldWrite = computeWouldWriteCounts(applyInput);

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

/** "would write: courses 36, programs 8, ..." — one count per WOULD_WRITE_TABLES entry, in that order. */
export function formatWouldWriteLine(counts: WouldWriteCounts): string {
  return `would write: ${WOULD_WRITE_TABLES.map((table) => `${table} ${counts[table]}`).join(", ")}`;
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

  if (!args.apply && result.wouldWrite) {
    stdout.push(`\n${formatWouldWriteLine(result.wouldWrite)}`);
  }

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

/**
 * True when this file is the script being run (not imported by a test).
 * Compares file URLs, not strings: on Windows argv[1] is "C:\dev\…" while
 * import.meta.url is "file:///C:/dev/…", so a plain `file://${argv[1]}`
 * never matched and the script silently did nothing.
 */
export function isDirectRun(moduleUrl: string, scriptPath: string | undefined): boolean {
  if (!scriptPath) return false;
  return moduleUrl === pathToFileURL(scriptPath).href;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
