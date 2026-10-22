// Upsert logic for --apply. Supabase client and embedder are both injected
// so tests can assert on calls without any network access.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBEDDING_DIMENSIONS,
  SCENARIO_IDS,
  type Course,
  type Programme,
  type ScenarioId,
} from "../../src/types/contracts";
import { arxivWindows } from "./arxiv";
import { escoUriToId, isBlank, splitNames } from "./cells";
import type { Issue } from "./report";
import type {
  DemandRow,
  ExposureRow,
  OccupationRow,
  OccupationSkillRow,
  ScenarioRow,
  SourceRow,
} from "./row-schemas";
import { demandByScenario } from "./scenario-demand";
import type { Embedder } from "./clients";
import { EmbeddingQuotaExceededError } from "./embedding-quota";

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
  demand: DemandRow[];
  scenarios: ScenarioRow[];
};

export type TableResult = { table: string; upserted: number; error?: string };
export type SkippedFile = { file: string; reason: string };

/** How far embedding one of the two embedded tables got. `remaining` is `total - done`; `stoppedByQuota` means a Gemini quota (not a bug) is why it isn't `total`. */
export type EmbeddingProgress = {
  table: "skills" | "occupations";
  total: number;
  done: number;
  remaining: number;
  stoppedByQuota: boolean;
};

export type ApplyResult = {
  tables: TableResult[];
  skipped: SkippedFile[];
  /** Always one entry for skills and one for occupations, in that order — see applyImport's embedding step. */
  embeddings: EmbeddingProgress[];
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

export type EmbeddingPlan = {
  /**
   * Embedding to use for each row in the non-embedding upsert below: a
   * reused vector (text unchanged), or a stale-but-valid previously stored
   * vector preserved as-is for a row whose text changed (it stays in
   * `toEmbed` and gets replaced once a fresh vector is computed). A row with
   * no entry here — brand new, or never successfully embedded before — gets
   * `null`, since there is nothing to preserve.
   */
  rowEmbeddings: Map<string, number[]>;
  /** Ids already present in the table, from the same select used for reuse — avoids a second query to tell new rows from existing ones. */
  existingIds: Set<string>;
  /** Rows that still need a fresh embedding computed, in input order. */
  toEmbed: { id: string; text: string }[];
};

/**
 * Decides which rows need a fresh embedding, without calling the embedder:
 * a row is skipped (resumed) when its text hasn't changed since the last
 * successful embed and it already has a valid stored vector; otherwise it
 * goes in `toEmbed` for fillEmbeddings to compute later, after every
 * non-embedding table has already been written (see applyImport).
 * `rebuildStoredText` must rebuild the same text a stored row would produce
 * today (via occupationEmbeddingText / skillEmbeddingText), so the
 * comparison is against the full embedded text, not just one column.
 */
export async function planEmbeddings(
  supabase: SupabaseClient,
  table: "occupations" | "skills",
  selectColumns: string,
  rebuildStoredText: (row: Record<string, unknown>) => string,
  rows: { id: string; text: string }[]
): Promise<EmbeddingPlan> {
  const rowEmbeddings = new Map<string, number[]>();
  if (rows.length === 0) return { rowEmbeddings, existingIds: new Set(), toEmbed: [] };

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
    const priorEmbeddingValid = Boolean(priorEmbedding && priorEmbedding.length === EMBEDDING_DIMENSIONS);

    if (prior && priorText === row.text && priorEmbeddingValid) {
      rowEmbeddings.set(row.id, priorEmbedding as number[]);
      continue;
    }
    // Needs a fresh embedding. Preserve whatever valid vector is already
    // stored (even though its text is now stale) so the non-embedding
    // upsert never nulls out a row that already has a real vector — it is
    // replaced once fillEmbeddings computes a fresh one.
    if (priorEmbeddingValid) rowEmbeddings.set(row.id, priorEmbedding as number[]);
    toEmbed.push(row);
  }

  return { rowEmbeddings, existingIds: new Set(existingById.keys()), toEmbed };
}

/** Values per embedMany call: Google's own per-call cap (model.maxEmbeddingsPerCall) is also 100, so one batch is one request. */
export const EMBED_BATCH_SIZE = 100;

/**
 * Computes and stores embeddings for `toEmbed`, one batch at a time, writing
 * each batch to the DB as soon as it's computed — so a quota error partway
 * through still leaves every already-embedded row saved, and a rerun only
 * has to redo the remainder. Stops (without throwing) on
 * EmbeddingQuotaExceededError; any other error still throws.
 */
export async function fillEmbeddings(
  supabase: SupabaseClient,
  table: "occupations" | "skills",
  toEmbed: { id: string; text: string }[],
  embedder: Embedder
): Promise<EmbeddingProgress> {
  let done = 0;
  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH_SIZE);
    let vectors: number[][];
    try {
      vectors = await embedder(batch.map((row) => row.text));
    } catch (error) {
      if (error instanceof EmbeddingQuotaExceededError) {
        return { table, total: toEmbed.length, done, remaining: toEmbed.length - done, stoppedByQuota: true };
      }
      throw error;
    }
    const rows = batch.map((row, index) => ({ id: row.id, embedding: vectors[index] }));
    const result = await upsert(supabase, table, rows);
    if (result.error) throw new Error(`failed to store ${table} embeddings: ${result.error}`);
    done += batch.length;
  }
  return { table, total: toEmbed.length, done, remaining: 0, stoppedByQuota: false };
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

/** Builds public.cluster_demand upsert rows (migration 20261022090000): demand.csv copied as-is. */
export function buildClusterDemandRows(rows: DemandRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    cluster: row.cluster,
    isco_major_group: row.iscoMajorGroup,
    metric: row.metric,
    value: row.value,
    period: row.period,
    prev_value: row.prevValue,
    prev_period: row.prevPeriod,
    source_name: row.sourceName,
    source_url: row.sourceUrl,
    table_or_dataset: row.tableOrDataset,
    as_of: row.asOf,
    notes: row.notes,
  }));
}

/**
 * Names and assumptions for public.scenarios (both NOT NULL). Our summary of
 * WEF "Four Futures for Jobs in the New Economy: AI and Talent in 2030"
 * (January 2026), whose scenarios these three are; no figure comes from it.
 */
export const SCENARIO_TEXT: Record<ScenarioId, { name: string; en: string; ms: string }> = {
  co: {
    name: "Co-Pilot Economy",
    en: "AI arrives gradually and skills keep pace, so AI mostly helps people work. Demand follows the average WEF 2025-2030 outlook for each cluster's jobs.",
    ms: "AI diterima secara beransur-ansur dan kemahiran seiring, jadi AI kebanyakannya membantu pekerja. Permintaan mengikut purata unjuran WEF 2025-2030 bagi pekerjaan setiap kelompok.",
  },
  dis: {
    name: "Age of Displacement",
    en: "AI moves faster than workers can retrain, and firms automate hard. Demand follows the weakest WEF 2025-2030 outlook among each cluster's jobs, and exposure counts more.",
    ms: "AI bergerak lebih pantas daripada latihan semula pekerja, dan syarikat mengautomasikan secara agresif. Permintaan mengikut unjuran WEF 2025-2030 paling lemah dalam setiap kelompok, dan pendedahan AI lebih diberi berat.",
  },
  sup: {
    name: "Supercharged Progress",
    en: "AI advances fast and workers are ready, so new roles scale quickly. Demand follows the strongest WEF 2025-2030 outlook among each cluster's jobs.",
    ms: "AI maju dengan pantas dan pekerja bersedia, jadi peranan baharu berkembang dengan cepat. Permintaan mengikut unjuran WEF 2025-2030 paling kukuh dalam setiap kelompok.",
  },
};

/**
 * Builds public.scenarios upsert rows: one per scenario in scenarios.csv,
 * with demand_by_cluster computed by demandByScenario (scenario-demand.ts)
 * from demand.csv and scenarios.csv. Needs occupations.csv for the weights,
 * so it builds nothing when any of the three is missing.
 */
export function buildScenarioRows(
  scenarios: ScenarioRow[],
  demand: DemandRow[],
  occupations: OccupationRow[]
): Record<string, unknown>[] {
  if (scenarios.length === 0 || demand.length === 0 || occupations.length === 0) return [];
  const demandByCluster = demandByScenario(demand, scenarios, occupations);
  return SCENARIO_IDS.filter((id) => scenarios.some((row) => row.scenarioId === id)).map((id) => ({
    id,
    name: SCENARIO_TEXT[id].name,
    assumptions_en: SCENARIO_TEXT[id].en,
    assumptions_ms: SCENARIO_TEXT[id].ms,
    // scenarioThetaIssues (cross-checks.ts) already made theta one value per scenario.
    theta: (scenarios.find((row) => row.scenarioId === id) as ScenarioRow).theta,
    demand_by_cluster: demandByCluster[id],
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

/** onConflict for the cluster_demand upsert: its primary key (migration 20261022090000). */
export const CLUSTER_DEMAND_ON_CONFLICT = "cluster,isco_major_group,metric,period";

/** onConflict for the occupation_skills upsert: its primary key (occupation_id, skill_id). */
export const OCCUPATION_SKILLS_ON_CONFLICT = "occupation_id,skill_id";

const SIGNALS_MIGRATION = "20261021150000";
const CLUSTER_DEMAND_MIGRATION = "20261022090000";

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
  // 42P01: relation does not exist. PGRST205: PostgREST cannot find the table.
  if (table === "cluster_demand" && (error.code === "42P01" || error.code === "PGRST205")) {
    return `apply migration ${CLUSTER_DEMAND_MIGRATION} first (it creates public.cluster_demand): ${error.message}`;
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

/**
 * Writes every table, then fills in embeddings last, so a Gemini quota error
 * (the free tier's 100-requests-per-minute cap, or a daily cap) never leaves
 * the run having written nothing:
 *
 *  1. skills, occupations — written with embedding left as whatever is
 *     already stored (never nulled out), or null for a brand-new row.
 *     Neither table's embedding column is involved in any FK, so this can't
 *     block anything downstream.
 *  2. sources — no catalogue FK.
 *  3. exposure, cluster_demand — both reference sources.name; exposure also
 *     references the occupations written in step 1 (nullable FK).
 *  4. scenarios, courses, programs — no catalogue FK.
 *  5. signals, then occupation_skills — both reference the skills/occupations
 *     ids written in step 1 (occupation_skills needs both).
 *  6. Finally, embeddings are computed and written in EMBED_BATCH_SIZE
 *     batches — skills, then occupations — upserting each batch immediately.
 *     A quota error here (fillEmbeddings) stops embedding but every table
 *     above is already durable; the caller reports done/remaining so a
 *     rerun can resume (rows already embedded are skipped by planEmbeddings).
 */
export async function applyImport(
  input: ApplyInput,
  supabase: SupabaseClient,
  embedder: Embedder
): Promise<ApplyResult> {
  const tables: TableResult[] = [];

  const skillPlan = await planEmbeddings(
    supabase,
    "skills",
    "id, label_en, embedding",
    (row) => skillEmbeddingText({ labelEn: String(row.label_en ?? "") }),
    input.skills.map((skill) => ({ id: skill.id, text: skillEmbeddingText(skill) }))
  );

  // Existing skills: update only the columns this importer owns, leaving
  // label_ms / is_green / base_importance as whoever curated them set them.
  // New skills: also seed those NOT NULL columns with placeholder defaults.
  const { existingRows: existingSkillRows, newRows: newSkillRows } = buildSkillRows(
    input.skills,
    skillPlan.existingIds,
    skillPlan.rowEmbeddings
  );

  const existingSkillsResult = await upsert(supabase, "skills", existingSkillRows);
  const newSkillsResult = await upsert(supabase, "skills", newSkillRows);
  tables.push(combineTableResults("skills", [existingSkillsResult, newSkillsResult]));

  const occupationPlan = await planEmbeddings(
    supabase,
    "occupations",
    "id, title_en, description, embedding",
    (row) =>
      occupationEmbeddingText({ titleEn: String(row.title_en ?? ""), description: String(row.description ?? "") }),
    input.occupations.map((occupation) => ({ id: occupation.id, text: occupationEmbeddingText(occupation) }))
  );
  tables.push(
    await upsert(supabase, "occupations", buildOccupationRows(input.occupations, occupationPlan.rowEmbeddings))
  );

  // sources before exposure: exposure.source_name references sources.name.
  tables.push(
    await upsert(supabase, "sources", buildSourceRows(input.sources), { onConflict: SOURCES_ON_CONFLICT })
  );

  tables.push(await upsert(supabase, "exposure", buildExposureRows(input.exposure, input.occupations), {
    onConflict: EXPOSURE_ON_CONFLICT,
  }));

  // After sources: cluster_demand.source_name references sources.name.
  tables.push(
    await upsert(supabase, "cluster_demand", buildClusterDemandRows(input.demand), {
      onConflict: CLUSTER_DEMAND_ON_CONFLICT,
    })
  );

  // results.scenario_id references scenarios.id; nothing scenarios needs is upserted later.
  tables.push(await upsert(supabase, "scenarios", buildScenarioRows(input.scenarios, input.demand, input.occupations)));

  tables.push(await upsert(supabase, "courses", buildCourseRows(input.courses)));

  tables.push(await upsert(supabase, "programs", buildProgramRows(input.programmes)));

  // signals.id has no natural upsert key of its own; onConflict targets
  // signals_reading_key instead, and no row here ever sets id.
  tables.push(
    await upsert(supabase, "signals", input.signals as unknown as Record<string, unknown>[], {
      onConflict: SIGNALS_ON_CONFLICT,
    })
  );

  // Both foreign keys (occupations, skills) were upserted above; embeddings
  // for those two tables are filled in last, below.
  tables.push(
    await upsert(supabase, "occupation_skills", buildOccupationSkillRows(input.occupationSkills), {
      onConflict: OCCUPATION_SKILLS_ON_CONFLICT,
    })
  );

  const skillEmbedding = await fillEmbeddings(supabase, "skills", skillPlan.toEmbed, embedder);
  // A quota hit is global (the same Gemini key, the same quota), so there is
  // no point even trying occupations once skills has already stopped on one.
  const occupationEmbedding = skillEmbedding.stoppedByQuota
    ? {
        table: "occupations" as const,
        total: occupationPlan.toEmbed.length,
        done: 0,
        remaining: occupationPlan.toEmbed.length,
        stoppedByQuota: true,
      }
    : await fillEmbeddings(supabase, "occupations", occupationPlan.toEmbed, embedder);

  return { tables, skipped: APPLY_SKIPPED_FILES, embeddings: [skillEmbedding, occupationEmbedding] };
}

/** Target tables, in the order --apply upserts them, that a dry run reports row counts for. */
export const WOULD_WRITE_TABLES = [
  "skills",
  "occupations",
  "sources",
  "exposure",
  "cluster_demand",
  "scenarios",
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
    cluster_demand: buildClusterDemandRows(input.demand).length,
    scenarios: buildScenarioRows(input.scenarios, input.demand, input.occupations).length,
    courses: buildCourseRows(input.courses).length,
    programs: buildProgramRows(input.programmes).length,
    signals: input.signals.length,
    occupation_skills: buildOccupationSkillRows(input.occupationSkills).length,
  };
}
