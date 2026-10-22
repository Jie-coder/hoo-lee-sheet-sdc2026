// Upsert logic for --apply. Supabase client and embedder are both injected
// so tests can assert on calls without any network access.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS, type Course, type Programme } from "../../src/types/contracts";
import { arxivWindows } from "./arxiv";
import { escoUriToId, isBlank, splitNames } from "./cells";
import type { Issue } from "./report";
import type { ExposureRow, OccupationRow, OccupationSkillRow, SourceRow } from "./row-schemas";
import type { Embedder } from "./clients";

export type SkillRecord = { id: string; escoUri: string; labelEn: string };

export type ApplyInput = {
  courses: Course[];
  programmes: Programme[];
  occupations: OccupationRow[];
  skills: SkillRecord[];
  signals: SignalRow[];
  sources: SourceRow[];
  exposure: ExposureRow[];
  occupationSkills: OccupationSkillRow[];
};

export type TableResult = { table: string; upserted: number; error?: string };
export type SkippedFile = { file: string; reason: string };

export type ApplyResult = {
  tables: TableResult[];
  skipped: SkippedFile[];
};

/** CSVs that validate fully but have nowhere to land in the current schema. */
export const APPLY_SKIPPED_FILES: SkippedFile[] = [];

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
 * base_importance b_s for a newly imported skill. 1 = neutral weight: every
 * essential skill counts the same, and arXiv momentum moves it up or down
 * (imp_s = b_s (1 + λ tanh(m_s)), src/lib/scoring.ts). It must not be 0:
 * fit divides by the importance total, so 0 makes every role's fit 0.
 */
export const DEFAULT_BASE_IMPORTANCE = 1;

/**
 * Builds the two skills upsert row sets: existing skills only get the columns
 * this importer owns (id, esco_uri, label_en, embedding), while a brand-new
 * skill also seeds label_ms / is_green / base_importance — all NOT NULL with
 * no default in the live schema — so the insert succeeds. label_ms and
 * is_green are placeholders; base_importance is the neutral weight above.
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
      base_importance: DEFAULT_BASE_IMPORTANCE,
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

/** Builds public.sources upsert rows. */
export function buildSourceRows(sources: SourceRow[]): Record<string, unknown>[] {
  return sources.map((source) => ({
    name: source.name,
    url: source.url,
    publisher: source.publisher,
    what_it_measures: source.whatItMeasures,
    update_frequency: source.updateFrequency,
    last_updated: source.lastUpdated,
    data_format: source.dataFormat,
    licence: source.licence,
    use_for: source.useFor,
    notes: source.notes,
  }));
}

/**
 * Finds the one occupations.csv row an exposure.csv row refers to, by exact
 * title_en first, falling back to code against isco_code/esco_uri only when
 * no title matches. Returns null (never invents) when nothing matches, or
 * when a match is not unique — isco_code repeats across occupations that
 * share one ISCO code, so a code match alone is not always unique.
 */
function matchOccupationId(exposure: ExposureRow, occupations: OccupationRow[]): string | null {
  const byUniqueMatch = (matches: (occupation: OccupationRow) => boolean): string | null => {
    const ids = new Set(occupations.filter(matches).map((occupation) => occupation.id));
    return ids.size === 1 ? (ids.values().next().value as string) : null;
  };

  const byTitle = byUniqueMatch((occupation) => occupation.titleEn === exposure.occupation);
  if (byTitle) return byTitle;

  return byUniqueMatch(
    (occupation) => occupation.iscoCode === exposure.code || occupation.escoUri === exposure.code
  );
}

/** Builds public.exposure upsert rows. occupation_id is filled in only for an unambiguous occupations.csv match. */
export function buildExposureRows(exposures: ExposureRow[], occupations: OccupationRow[]): Record<string, unknown>[] {
  return exposures.map((exposure) => ({
    occupation_id: matchOccupationId(exposure, occupations),
    occupation: exposure.occupation,
    code: exposure.code,
    exposure_value: exposure.exposureValue,
    scale: exposure.scale,
    source_name: exposure.sourceName,
    source_url: exposure.sourceUrl,
    table_or_page: exposure.tableOrPage,
    as_of: exposure.asOf,
    notes: exposure.notes,
  }));
}

/**
 * Builds public.occupation_skills upsert rows. skill_id uses the same
 * escoUriToId as the skills table, so it matches the row deriveSkills makes
 * for the same URI.
 */
export function buildOccupationSkillRows(rows: OccupationSkillRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    occupation_id: row.occupationId,
    skill_id: escoUriToId(row.skillUri),
    relation: row.relation,
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
  keywords: string[];
};

/** One row of keywords.csv, raw (string) cells, zipped with its header. */
export type SignalRowInput = { row: number; raw: Record<string, string> };

/** The arXiv API query URL whose search_query ORs every contributing arxiv_query value, each wrapped as all:(...), urlencoded. */
export function arxivQueryUrl(arxivQueries: string[]): string {
  const searchQuery = arxivQueries.map((query) => `all:(${query})`).join(" OR ");
  return `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}`;
}

const SIGNAL_METRIC = "arxiv_papers_90d";

/** One keyword's contribution to one signals reading, before same-key contributions are summed. */
type SignalContribution = {
  skillId: string;
  windowStart: string;
  windowEnd: string;
  checkedOn: string;
  value: number;
  keyword: string;
  arxivQuery: string;
};

/** The columns signals_reading_key (migration 20261021150000) is unique on. */
function signalReadingKey(signal: Pick<SignalContribution, "skillId" | "windowEnd">): string {
  return `${signal.skillId}|arXiv|${SIGNAL_METRIC}|${signal.windowEnd}`;
}

/** Adds an item to a list already known not to contain it, preserving first-seen order. */
function pushUnique(list: string[], item: string): void {
  if (!list.includes(item)) list.push(item);
}

/**
 * Builds the public.signals row shape for keywords.csv: two rows (current
 * and preceding 90-day window) per ESCO skill URI on a keyword. Two keywords
 * that map to the same skill and share a checked_on produce the same
 * (skill_id, source, metric, window_end) — the signals_reading_key this
 * importer upserts on — so their counts are summed into one row, and every
 * contributing keyword is recorded in that row's `keywords` column.
 */
export function buildSignalRows(inputs: SignalRowInput[]): { rows: SignalRow[]; warnings: Issue[] } {
  const contributions: SignalContribution[] = [];
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
    const keyword = raw.keyword ?? "";
    const arxivQuery = raw.arxiv_query ?? "";
    const skillUris = splitNames(raw.skill_uris ?? "");

    // The same two windows scripts/fetch-arxiv.ts counted the papers in.
    const windows = arxivWindows(checkedOn);
    for (const uri of skillUris) {
      const skillId = escoUriToId(uri);
      contributions.push({
        skillId,
        windowEnd: windows.recent.end,
        windowStart: windows.recent.start,
        checkedOn,
        value: countLast90d,
        keyword,
        arxivQuery,
      });
      contributions.push({
        skillId,
        windowEnd: windows.previous.end,
        windowStart: windows.previous.start,
        checkedOn,
        value: countPrev90d,
        keyword,
        arxivQuery,
      });
    }
  }

  const groups = new Map<string, SignalContribution[]>();
  const keyOrder: string[] = [];
  for (const contribution of contributions) {
    const key = signalReadingKey(contribution);
    const group = groups.get(key);
    if (group) {
      group.push(contribution);
    } else {
      groups.set(key, [contribution]);
      keyOrder.push(key);
    }
  }

  const rows: SignalRow[] = keyOrder.map((key) => {
    const group = groups.get(key) as SignalContribution[];
    const [first] = group;
    const keywords: string[] = [];
    const arxivQueries: string[] = [];
    let value = 0;
    let asOf = first.checkedOn;
    for (const contribution of group) {
      value += contribution.value;
      if (contribution.checkedOn > asOf) asOf = contribution.checkedOn;
      pushUnique(keywords, contribution.keyword);
      pushUnique(arxivQueries, contribution.arxivQuery);
    }
    return {
      skill_id: first.skillId,
      source: "arXiv",
      metric: SIGNAL_METRIC,
      value,
      window_start: first.windowStart,
      window_end: first.windowEnd,
      as_of: asOf,
      url: arxivQueryUrl(arxivQueries),
      keywords,
    };
  });

  return { rows, warnings };
}

/** PostgREST / Supabase requests are more reliable in batches than as one giant array. */
const UPSERT_CHUNK_SIZE = 500;

/** onConflict for the signals upsert: the columns signals_reading_key (migration 20261021150000) is unique on. */
export const SIGNALS_ON_CONFLICT = "skill_id,source,metric,window_end";

/** onConflict for the exposure upsert: public.exposure's primary key (occupation, source_name). */
export const EXPOSURE_ON_CONFLICT = "occupation,source_name";

/** onConflict for the sources upsert: public.sources's primary key is name, not id. */
export const SOURCES_ON_CONFLICT = "name";

/** onConflict for the occupation_skills upsert: its primary key (occupation_id, skill_id). */
export const OCCUPATION_SKILLS_ON_CONFLICT = "occupation_id,skill_id";

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

  // sources before exposure: exposure.source_name references sources.name.
  tables.push(
    await upsert(supabase, "sources", buildSourceRows(input.sources), { onConflict: SOURCES_ON_CONFLICT })
  );

  tables.push(await upsert(supabase, "exposure", buildExposureRows(input.exposure, input.occupations), {
    onConflict: EXPOSURE_ON_CONFLICT,
  }));

  tables.push(await upsert(supabase, "courses", buildCourseRows(input.courses)));

  tables.push(await upsert(supabase, "programs", buildProgramRows(input.programmes)));

  // signals.id has no natural upsert key of its own; onConflict targets
  // signals_reading_key instead, and no row here ever sets id.
  tables.push(
    await upsert(supabase, "signals", input.signals as unknown as Record<string, unknown>[], {
      onConflict: SIGNALS_ON_CONFLICT,
    })
  );

  // Last: both foreign keys (occupations, skills) were upserted above.
  tables.push(
    await upsert(supabase, "occupation_skills", buildOccupationSkillRows(input.occupationSkills), {
      onConflict: OCCUPATION_SKILLS_ON_CONFLICT,
    })
  );

  return { tables, skipped: APPLY_SKIPPED_FILES };
}

/** Target tables, in the order --apply upserts them, that a dry run reports row counts for. */
export const WOULD_WRITE_TABLES = [
  "skills",
  "occupations",
  "sources",
  "exposure",
  "courses",
  "programs",
  "signals",
  "occupation_skills",
] as const;

export type WouldWriteCounts = Record<(typeof WOULD_WRITE_TABLES)[number], number>;

/**
 * Row counts a dry run would write, built from the same functions --apply
 * uses (minus the embedding calls, which do not change how many rows are
 * written).
 */
export function computeWouldWriteCounts(input: ApplyInput): WouldWriteCounts {
  const noEmbeddings = new Map<string, number[]>();
  const { existingRows, newRows } = buildSkillRows(input.skills, new Set(), noEmbeddings);
  return {
    skills: existingRows.length + newRows.length,
    occupations: buildOccupationRows(input.occupations, noEmbeddings).length,
    sources: buildSourceRows(input.sources).length,
    exposure: buildExposureRows(input.exposure, input.occupations).length,
    courses: buildCourseRows(input.courses).length,
    programs: buildProgramRows(input.programmes).length,
    signals: input.signals.length,
    occupation_skills: buildOccupationSkillRows(input.occupationSkills).length,
  };
}
