// Upsert logic for --apply. Supabase client and embedder are both injected
// so tests can assert on calls without any network access.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS, type Course, type Programme } from "../../src/types/contracts";
import { escoUriToId, isBlank, splitNames } from "./cells";
import type { Issue } from "./report";
import type { OccupationRow } from "./row-schemas";
import type { Embedder } from "./clients";

export type SkillRecord = { id: string; escoUri: string; labelEn: string };

export type ApplyInput = {
  courses: Course[];
  programmes: Programme[];
  occupations: OccupationRow[];
  skills: SkillRecord[];
  signals: SignalRow[];
};

export type TableResult = { table: string; upserted: number; error?: string };
export type SkippedFile = { file: string; reason: string };

export type ApplyResult = {
  tables: TableResult[];
  skipped: SkippedFile[];
};

/** CSVs that validate fully but have nowhere to land in the current schema. */
export const APPLY_SKIPPED_FILES: SkippedFile[] = [
  {
    file: "sources.csv",
    reason: "table added in migration 20261021150000, not yet applied to live DB",
  },
  {
    file: "exposure.csv",
    reason: "table added in migration 20261021150000, not yet applied to live DB",
  },
];

/** The text embedded for one occupation: must match how a stored row's text is rebuilt below. */
export function occupationEmbeddingText(occupation: { titleEn: string; description: string }): string {
  return [occupation.titleEn, occupation.description].filter(Boolean).join(". ");
}

/** The text embedded for one skill: must match how a stored row's text is rebuilt below. */
export function skillEmbeddingText(skill: { labelEn: string }): string {
  return skill.labelEn;
}

function parseStoredEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export type EmbeddingReuseResult = {
  embeddings: Map<string, number[]>;
  /** Ids already present in the table, from the same select used for reuse — avoids a second query to tell new rows from existing ones. */
  existingIds: Set<string>;
};

/**
 * Computes one embedding per row, reusing a previously stored vector when
 * the embedding text has not changed. `rebuildStoredText` must rebuild the
 * same text a stored row would produce today (via occupationEmbeddingText /
 * skillEmbeddingText), so the comparison is against the full embedded text,
 * not just one column. Falls back to embedding everything when the existing
 * rows cannot be read (for example, the table is empty).
 */
export async function computeEmbeddingsWithReuse(
  supabase: SupabaseClient,
  table: "occupations" | "skills",
  selectColumns: string,
  rebuildStoredText: (row: Record<string, unknown>) => string,
  rows: { id: string; text: string }[],
  embedder: Embedder
): Promise<EmbeddingReuseResult> {
  const embeddings = new Map<string, number[]>();
  if (rows.length === 0) return { embeddings, existingIds: new Set() };

  const ids = rows.map((row) => row.id);
  const { data: existing } = (await supabase.from(table).select(selectColumns).in("id", ids)) as {
    data: Record<string, unknown>[] | null;
  };

  const existingById = new Map<string, Record<string, unknown>>(
    (existing ?? []).map((row) => [String(row.id), row])
  );

  const toEmbed: { id: string; text: string }[] = [];
  for (const row of rows) {
    const prior = existingById.get(row.id);
    const priorEmbedding = prior ? parseStoredEmbedding(prior.embedding) : null;
    const priorText = prior ? rebuildStoredText(prior) : null;
    if (prior && priorText === row.text && priorEmbedding && priorEmbedding.length === EMBEDDING_DIMENSIONS) {
      embeddings.set(row.id, priorEmbedding);
    } else {
      toEmbed.push(row);
    }
  }

  if (toEmbed.length > 0) {
    const vectors = await embedder(toEmbed.map((row) => row.text));
    toEmbed.forEach((row, index) => embeddings.set(row.id, vectors[index]));
  }

  return { embeddings, existingIds: new Set(existingById.keys()) };
}

/**
 * Builds the two skills upsert row sets: existing skills only get the columns
 * this importer owns (id, esco_uri, label_en, embedding), while a brand-new
 * skill also seeds label_ms / is_green / base_importance — all NOT NULL with
 * no default in the live schema — with placeholders so the insert succeeds.
 */
export function buildSkillRows(
  skills: SkillRecord[],
  existingIds: Set<string>,
  embeddings: Map<string, number[]>
): { existingRows: Record<string, unknown>[]; newRows: Record<string, unknown>[] } {
  const existingRows = skills
    .filter((skill) => existingIds.has(skill.id))
    .map((skill) => ({
      id: skill.id,
      esco_uri: skill.escoUri,
      label_en: skill.labelEn,
      embedding: embeddings.get(skill.id) ?? null,
    }));

  const newRows = skills
    .filter((skill) => !existingIds.has(skill.id))
    .map((skill) => ({
      id: skill.id,
      esco_uri: skill.escoUri,
      label_en: skill.labelEn,
      label_ms: skill.labelEn,
      is_green: false,
      base_importance: 0,
      embedding: embeddings.get(skill.id) ?? null,
    }));

  return { existingRows, newRows };
}

/** Builds public.occupations upsert rows. */
export function buildOccupationRows(
  occupations: OccupationRow[],
  embeddings: Map<string, number[]>
): Record<string, unknown>[] {
  return occupations.map((occupation) => ({
    id: occupation.id,
    esco_uri: occupation.escoUri,
    isco_code: occupation.iscoCode,
    title_en: occupation.titleEn,
    title_ms: occupation.titleMs,
    description: occupation.description,
    cluster: occupation.cluster,
    is_emerging: occupation.isEmerging,
    embedding: embeddings.get(occupation.id) ?? null,
  }));
}

/** Builds public.courses upsert rows. */
export function buildCourseRows(courses: Course[]): Record<string, unknown>[] {
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    provider: course.provider,
    url: course.url,
    languages: course.languages,
    hours: course.hours,
    cost_type: course.costType,
    certificate: course.certificate,
    skill_ids: course.skillIds,
    last_checked: course.lastChecked,
    mode: course.mode,
  }));
}

/** Builds public.programs upsert rows. */
export function buildProgramRows(programmes: Programme[]): Record<string, unknown>[] {
  return programmes.map((programme) => ({
    id: programme.id,
    name: programme.name,
    agency: programme.agency,
    url: programme.url,
    benefits: programme.benefits,
    eligibility: programme.eligibility,
    cost_type: programme.costType,
    deadline: programme.deadline,
    last_checked: programme.lastChecked,
  }));
}

export type SignalRow = {
  skill_id: string;
  source: "arXiv";
  metric: string;
  value: number;
  window_start: string;
  window_end: string;
  as_of: string;
  url: string;
};

/** One row of keywords.csv, raw (string) cells, zipped with its header. */
export type SignalRowInput = { row: number; raw: Record<string, string> };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Shifts an ISO date (YYYY-MM-DD) by a whole number of days, UTC. */
function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** The arXiv API query URL for one arxiv_query cell: all-fields search, urlencoded. */
export function arxivQueryUrl(arxivQuery: string): string {
  return `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:${arxivQuery}`)}`;
}

const SIGNAL_METRIC = "arxiv_papers_90d";
const WINDOW_DAYS = 90;

/** The columns signals_reading_key (migration 20261021150000) is unique on. */
function signalReadingKey(signal: Pick<SignalRow, "skill_id" | "source" | "metric" | "window_end">): string {
  return `${signal.skill_id}|${signal.source}|${signal.metric}|${signal.window_end}`;
}

/**
 * Builds the public.signals row shape for keywords.csv: two rows (current
 * and preceding 90-day window) per ESCO skill URI on a keyword. Two keywords
 * that map to the same skill and share a checked_on produce the same
 * (skill_id, source, metric, window_end) — the signals_reading_key this
 * importer upserts on — so a later row with the same key is dropped (not
 * summed: summing two different arXiv counts for the same window would be
 * meaningless) and reported as a warning instead.
 */
export function buildSignalRows(inputs: SignalRowInput[]): { rows: SignalRow[]; warnings: Issue[] } {
  const built: { row: number; signal: SignalRow }[] = [];
  const warnings: Issue[] = [];

  for (const { row, raw } of inputs) {
    const checkedOn = raw.checked_on ?? "";
    const countLastRaw = raw.count_last_90d ?? "";
    const countPrevRaw = raw.count_prev_90d ?? "";

    if (isBlank(checkedOn) || isBlank(countLastRaw) || isBlank(countPrevRaw)) {
      warnings.push({
        file: "keywords.csv",
        row,
        message: "checked_on, count_last_90d, or count_prev_90d is blank; skipping this keyword's signals",
        hint: "fill in all three, or this keyword contributes no signals",
        severity: "warning",
      });
      continue;
    }

    const countLast90d = Number(countLastRaw);
    const countPrev90d = Number(countPrevRaw);
    const url = arxivQueryUrl(raw.arxiv_query ?? "");
    const skillUris = splitNames(raw.skill_uris ?? "");

    for (const uri of skillUris) {
      const skillId = escoUriToId(uri);
      built.push({
        row,
        signal: {
          skill_id: skillId,
          source: "arXiv",
          metric: SIGNAL_METRIC,
          value: countLast90d,
          window_end: checkedOn,
          window_start: shiftIsoDate(checkedOn, -WINDOW_DAYS),
          as_of: checkedOn,
          url,
        },
      });
      built.push({
        row,
        signal: {
          skill_id: skillId,
          source: "arXiv",
          metric: SIGNAL_METRIC,
          value: countPrev90d,
          window_end: shiftIsoDate(checkedOn, -(WINDOW_DAYS + 1)),
          window_start: shiftIsoDate(checkedOn, -(2 * WINDOW_DAYS + 1)),
          as_of: checkedOn,
          url,
        },
      });
    }
  }

  const rows: SignalRow[] = [];
  const firstRowForKey = new Map<string, number>();
  for (const { row, signal } of built) {
    const key = signalReadingKey(signal);
    const firstRow = firstRowForKey.get(key);
    if (firstRow === undefined) {
      firstRowForKey.set(key, row);
      rows.push(signal);
      continue;
    }
    warnings.push({
      file: "keywords.csv",
      row,
      column: "skill_uris",
      message:
        `duplicate signals reading for skill_id "${signal.skill_id}", metric "${signal.metric}", ` +
        `window ending ${signal.window_end}: already produced by row ${firstRow}`,
      hint: "two keywords map to the same ESCO skill with the same checked_on; only the first keyword's reading is kept for this window",
      severity: "warning",
    });
  }

  return { rows, warnings };
}

/** PostgREST / Supabase requests are more reliable in batches than as one giant array. */
const UPSERT_CHUNK_SIZE = 500;

/** onConflict for the signals upsert: the columns signals_reading_key (migration 20261021150000) is unique on. */
export const SIGNALS_ON_CONFLICT = "skill_id,source,metric,window_end";

const SIGNALS_MIGRATION = "20261021150000";

/** True for the Postgres error an upsert gets when its onConflict columns have no matching unique constraint yet. */
function isMissingOnConflictConstraint(error: { code?: string; message: string }): boolean {
  return error.code === "42P10" || /no unique or exclusion constraint/i.test(error.message);
}

/** Turns a raw Postgrest error into the message apply.ts reports for a table, adding guidance for signals specifically. */
function describeUpsertError(table: string, error: { code?: string; message: string }): string {
  if (table === "signals" && isMissingOnConflictConstraint(error)) {
    return (
      `apply migration ${SIGNALS_MIGRATION} first (it adds signals_reading_key, the unique constraint ` +
      `this upsert's onConflict "${SIGNALS_ON_CONFLICT}" needs): ${error.message}`
    );
  }
  return error.message;
}

async function upsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  options: { onConflict?: string } = {}
): Promise<TableResult> {
  if (rows.length === 0) return { table, upserted: 0 };
  const onConflict = options.onConflict ?? "id";
  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) return { table, upserted, error: describeUpsertError(table, error) };
    upserted += chunk.length;
  }
  return { table, upserted };
}

/** Combines two upserts against the same table into one reported result. */
function combineTableResults(table: string, results: TableResult[]): TableResult {
  const upserted = results.reduce((total, result) => total + result.upserted, 0);
  const failed = results.find((result) => result.error);
  return failed ? { table, upserted, error: failed.error } : { table, upserted };
}

export async function applyImport(
  input: ApplyInput,
  supabase: SupabaseClient,
  embedder: Embedder
): Promise<ApplyResult> {
  const tables: TableResult[] = [];

  const skillEmbeddingResult = await computeEmbeddingsWithReuse(
    supabase,
    "skills",
    "id, label_en, embedding",
    (row) => skillEmbeddingText({ labelEn: String(row.label_en ?? "") }),
    input.skills.map((skill) => ({ id: skill.id, text: skillEmbeddingText(skill) })),
    embedder
  );

  // Existing skills: update only the columns this importer owns, leaving
  // label_ms / is_green / base_importance as whoever curated them set them.
  // New skills: also seed those NOT NULL columns with placeholder defaults.
  const { existingRows: existingSkillRows, newRows: newSkillRows } = buildSkillRows(
    input.skills,
    skillEmbeddingResult.existingIds,
    skillEmbeddingResult.embeddings
  );

  const existingSkillsResult = await upsert(supabase, "skills", existingSkillRows);
  const newSkillsResult = await upsert(supabase, "skills", newSkillRows);
  tables.push(combineTableResults("skills", [existingSkillsResult, newSkillsResult]));

  const occupationEmbeddingResult = await computeEmbeddingsWithReuse(
    supabase,
    "occupations",
    "id, title_en, description, embedding",
    (row) =>
      occupationEmbeddingText({ titleEn: String(row.title_en ?? ""), description: String(row.description ?? "") }),
    input.occupations.map((occupation) => ({ id: occupation.id, text: occupationEmbeddingText(occupation) })),
    embedder
  );
  tables.push(
    await upsert(supabase, "occupations", buildOccupationRows(input.occupations, occupationEmbeddingResult.embeddings))
  );

  tables.push(await upsert(supabase, "courses", buildCourseRows(input.courses)));

  tables.push(await upsert(supabase, "programs", buildProgramRows(input.programmes)));

  // signals.id has no natural upsert key of its own; onConflict targets
  // signals_reading_key instead, and no row here ever sets id.
  tables.push(
    await upsert(supabase, "signals", input.signals as unknown as Record<string, unknown>[], {
      onConflict: SIGNALS_ON_CONFLICT,
    })
  );

  return { tables, skipped: APPLY_SKIPPED_FILES };
}
