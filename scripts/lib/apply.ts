// Upsert logic for --apply. Supabase client and embedder are both injected
// so tests can assert on calls without any network access.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS, type Course, type Programme } from "../../src/types/contracts";
import type { OccupationRow } from "./row-schemas";
import type { Embedder } from "./clients";

export type SkillRecord = { id: string; escoUri: string; labelEn: string };

export type ApplyInput = {
  courses: Course[];
  programmes: Programme[];
  occupations: OccupationRow[];
  skills: SkillRecord[];
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
    reason: "no matching table in the migrations (there is no public.sources table)",
  },
  {
    file: "keywords.csv",
    reason:
      "public.signals needs a url and a window_start/window_end per reading; keywords.csv has neither, so mapping would mean inventing them",
  },
  {
    file: "exposure.csv",
    reason:
      "no matching table in the migrations (public.results.exposure is computed per profile at runtime, not stored as seed data)",
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

/** PostgREST / Supabase requests are more reliable in batches than as one giant array. */
const UPSERT_CHUNK_SIZE = 500;

async function upsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<TableResult> {
  if (rows.length === 0) return { table, upserted: 0 };
  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) return { table, upserted, error: error.message };
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
  const existingSkills = input.skills.filter((skill) => skillEmbeddingResult.existingIds.has(skill.id));
  const newSkills = input.skills.filter((skill) => !skillEmbeddingResult.existingIds.has(skill.id));

  const existingSkillsResult = await upsert(
    supabase,
    "skills",
    existingSkills.map((skill) => ({
      id: skill.id,
      esco_uri: skill.escoUri,
      label_en: skill.labelEn,
      embedding: skillEmbeddingResult.embeddings.get(skill.id) ?? null,
    }))
  );
  const newSkillsResult = await upsert(
    supabase,
    "skills",
    newSkills.map((skill) => ({
      id: skill.id,
      esco_uri: skill.escoUri,
      label_en: skill.labelEn,
      label_ms: skill.labelEn,
      is_green: false,
      base_importance: 0,
      embedding: skillEmbeddingResult.embeddings.get(skill.id) ?? null,
    }))
  );
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
    await upsert(
      supabase,
      "occupations",
      input.occupations.map((occupation) => ({
        id: occupation.id,
        esco_uri: occupation.escoUri,
        isco_code: occupation.iscoCode,
        title_en: occupation.titleEn,
        title_ms: occupation.titleMs,
        description: occupation.description,
        cluster: occupation.cluster,
        is_emerging: occupation.isEmerging,
        embedding: occupationEmbeddingResult.embeddings.get(occupation.id) ?? null,
      }))
    )
  );

  tables.push(
    await upsert(
      supabase,
      "courses",
      input.courses.map((course) => ({
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
      }))
    )
  );

  tables.push(
    await upsert(
      supabase,
      "programs",
      input.programmes.map((programme) => ({
        id: programme.id,
        name: programme.name,
        agency: programme.agency,
        url: programme.url,
        benefits: programme.benefits,
        eligibility: programme.eligibility,
        cost_type: programme.costType,
        deadline: programme.deadline,
        last_checked: programme.lastChecked,
      }))
    )
  );

  return { tables, skipped: APPLY_SKIPPED_FILES };
}
