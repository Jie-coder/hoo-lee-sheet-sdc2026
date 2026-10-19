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

/**
 * Computes one embedding per row, reusing a previously stored vector when
 * the embedding text has not changed. Falls back to embedding everything
 * when the existing rows cannot be read (for example, the table is empty).
 */
export async function computeEmbeddingsWithReuse(
  supabase: SupabaseClient,
  table: "occupations" | "skills",
  textColumn: "title_en" | "label_en",
  rows: { id: string; text: string }[],
  embedder: Embedder
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (rows.length === 0) return result;

  const ids = rows.map((row) => row.id);
  const { data: existing } = await supabase
    .from(table)
    .select(`id, ${textColumn}, embedding`)
    .in("id", ids);

  const existingById = new Map<string, Record<string, unknown>>(
    (existing ?? []).map((row: Record<string, unknown>) => [String(row.id), row])
  );

  const toEmbed: { id: string; text: string }[] = [];
  for (const row of rows) {
    const prior = existingById.get(row.id);
    const priorEmbedding = prior ? parseStoredEmbedding(prior.embedding) : null;
    if (
      prior &&
      prior[textColumn] === row.text &&
      priorEmbedding &&
      priorEmbedding.length === EMBEDDING_DIMENSIONS
    ) {
      result.set(row.id, priorEmbedding);
    } else {
      toEmbed.push(row);
    }
  }

  if (toEmbed.length > 0) {
    const vectors = await embedder(toEmbed.map((row) => row.text));
    toEmbed.forEach((row, index) => result.set(row.id, vectors[index]));
  }

  return result;
}

async function upsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<TableResult> {
  if (rows.length === 0) return { table, upserted: 0 };
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) return { table, upserted: 0, error: error.message };
  return { table, upserted: rows.length };
}

export async function applyImport(
  input: ApplyInput,
  supabase: SupabaseClient,
  embedder: Embedder
): Promise<ApplyResult> {
  const tables: TableResult[] = [];

  const skillEmbeddings = await computeEmbeddingsWithReuse(
    supabase,
    "skills",
    "label_en",
    input.skills.map((skill) => ({ id: skill.id, text: skill.labelEn })),
    embedder
  );
  tables.push(
    await upsert(
      supabase,
      "skills",
      input.skills.map((skill) => ({
        id: skill.id,
        esco_uri: skill.escoUri,
        label_en: skill.labelEn,
        label_ms: skill.labelEn,
        is_green: false,
        base_importance: 0,
        embedding: skillEmbeddings.get(skill.id) ?? null,
      }))
    )
  );

  const occupationEmbeddings = await computeEmbeddingsWithReuse(
    supabase,
    "occupations",
    "title_en",
    input.occupations.map((occupation) => ({
      id: occupation.id,
      text: [occupation.titleEn, occupation.description].filter(Boolean).join(". "),
    })),
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
        embedding: occupationEmbeddings.get(occupation.id) ?? null,
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
