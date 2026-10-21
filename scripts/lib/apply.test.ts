import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS } from "../../src/types/contracts";
import {
  applyImport,
  computeEmbeddingsWithReuse,
  occupationEmbeddingText,
  skillEmbeddingText,
  SIGNALS_ON_CONFLICT,
  type ApplyInput,
  type SignalRow,
} from "./apply";
import type { Embedder } from "./clients";

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i / 1000);
}

/** A minimal fake Supabase client: just enough of .from().upsert()/.select().in() to drive apply.ts. */
function fakeSupabase(existingByTable: Record<string, Record<string, unknown>[]> = {}) {
  const upserts: { table: string; rows: Record<string, unknown>[]; onConflict?: string }[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: Record<string, unknown>[], options?: { onConflict?: string }) {
          upserts.push({ table, rows, onConflict: options?.onConflict });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            in() {
              return Promise.resolve({ data: existingByTable[table] ?? [] });
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, upserts };
}

const SKILL_SELECT = "id, label_en, embedding";
const rebuildSkillText = (row: Record<string, unknown>) =>
  skillEmbeddingText({ labelEn: String(row.label_en ?? "") });

describe("computeEmbeddingsWithReuse", () => {
  it("embeds every row when the table is empty, in one batched call", async () => {
    const { client } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const result = await computeEmbeddingsWithReuse(
      client,
      "skills",
      SKILL_SELECT,
      rebuildSkillText,
      [
        { id: "s1", text: "Data analysis" },
        { id: "s2", text: "Communication" },
      ],
      embedder
    );

    expect(embedder).toHaveBeenCalledTimes(1);
    expect(embedder).toHaveBeenCalledWith(["Data analysis", "Communication"]);
    expect(result.embeddings.get("s1")).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(result.embeddings.get("s2")).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(result.existingIds.size).toBe(0);
  });

  it("reuses a stored embedding when the text has not changed", async () => {
    const stored = vector(7);
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Data analysis", embedding: stored }],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(99 + i)));

    const result = await computeEmbeddingsWithReuse(
      client,
      "skills",
      SKILL_SELECT,
      rebuildSkillText,
      [{ id: "s1", text: "Data analysis" }],
      embedder
    );

    expect(embedder).not.toHaveBeenCalled();
    expect(result.embeddings.get("s1")).toEqual(stored);
    expect(result.existingIds).toEqual(new Set(["s1"]));
  });

  it("re-embeds when the text changed, even if a row already exists", async () => {
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Old label", embedding: vector(1) }],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(50 + i)));

    const result = await computeEmbeddingsWithReuse(
      client,
      "skills",
      SKILL_SELECT,
      rebuildSkillText,
      [{ id: "s1", text: "New label" }],
      embedder
    );

    expect(embedder).toHaveBeenCalledWith(["New label"]);
    expect(result.embeddings.get("s1")).toEqual(vector(50));
  });

  it("reuses a stored occupation embedding when title_en + description together are unchanged", async () => {
    const stored = vector(3);
    const { client } = fakeSupabase({
      occupations: [
        { id: "o1", title_en: "Data Analyst", description: "Analyses data.", embedding: stored },
      ],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(99 + i)));

    const occupation = { titleEn: "Data Analyst", description: "Analyses data." };
    const result = await computeEmbeddingsWithReuse(
      client,
      "occupations",
      "id, title_en, description, embedding",
      (row) =>
        occupationEmbeddingText({ titleEn: String(row.title_en ?? ""), description: String(row.description ?? "") }),
      [{ id: "o1", text: occupationEmbeddingText(occupation) }],
      embedder
    );

    expect(embedder).not.toHaveBeenCalled();
    expect(result.embeddings.get("o1")).toEqual(stored);
  });

  it("re-embeds an occupation when only the description changed (title_en alone still matches)", async () => {
    const { client } = fakeSupabase({
      occupations: [
        { id: "o1", title_en: "Data Analyst", description: "Old description.", embedding: vector(1) },
      ],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(50 + i)));

    const occupation = { titleEn: "Data Analyst", description: "New description." };
    const result = await computeEmbeddingsWithReuse(
      client,
      "occupations",
      "id, title_en, description, embedding",
      (row) =>
        occupationEmbeddingText({ titleEn: String(row.title_en ?? ""), description: String(row.description ?? "") }),
      [{ id: "o1", text: occupationEmbeddingText(occupation) }],
      embedder
    );

    expect(embedder).toHaveBeenCalledWith([occupationEmbeddingText(occupation)]);
    expect(result.embeddings.get("o1")).toEqual(vector(50));
  });
});

const EMPTY_INPUT: ApplyInput = { courses: [], programmes: [], occupations: [], skills: [], signals: [] };

function signalRow(overrides: Partial<SignalRow> = {}): SignalRow {
  return {
    skill_id: "00000000-0000-0000-0000-000000000001",
    source: "arXiv",
    metric: "arxiv_papers_90d",
    value: 10,
    window_start: "2026-07-01",
    window_end: "2026-10-01",
    as_of: "2026-10-01",
    url: "https://export.arxiv.org/api/query?search_query=all%3Atest",
    ...overrides,
  };
}

describe("applyImport", () => {
  it("upserts courses, programs, skills, and occupations with snake_case columns", async () => {
    const { client, upserts } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      courses: [
        {
          id: "c001",
          title: "Intro to Data Analysis",
          provider: "Contoso Learning",
          url: "https://example.com/courses/data-analysis",
          languages: ["en"],
          hours: 20,
          costType: "free",
          certificate: true,
          skillIds: ["00000000-0000-0000-0000-000000000001"],
          lastChecked: "2026-10-01",
          mode: "hybrid",
        },
      ],
      occupations: [
        {
          id: "o001",
          escoUri: null,
          iscoCode: "2512",
          titleEn: "Data Analyst",
          titleMs: "Penganalisis Data",
          description: "Analyses data.",
          cluster: "data_analytics",
          isEmerging: false,
          lastChecked: "2026-10-01",
          notes: "",
        },
      ],
      skills: [{ id: "00000000-0000-0000-0000-000000000001", escoUri: "https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000001", labelEn: "Data analysis" }],
    };

    const result = await applyImport(input, client, embedder);

    const coursesUpsert = upserts.find((u) => u.table === "courses");
    expect(coursesUpsert?.rows).toEqual([
      {
        id: "c001",
        title: "Intro to Data Analysis",
        provider: "Contoso Learning",
        url: "https://example.com/courses/data-analysis",
        languages: ["en"],
        hours: 20,
        cost_type: "free",
        certificate: true,
        skill_ids: ["00000000-0000-0000-0000-000000000001"],
        last_checked: "2026-10-01",
        mode: "hybrid",
      },
    ]);

    // A brand-new skill: gets the placeholder defaults for the NOT NULL columns.
    const skillsUpserts = upserts.filter((u) => u.table === "skills");
    const newSkillRow = skillsUpserts.flatMap((u) => u.rows).find((row) => row.id === "00000000-0000-0000-0000-000000000001");
    expect(newSkillRow).toMatchObject({ id: "00000000-0000-0000-0000-000000000001", label_ms: "Data analysis", is_green: false, base_importance: 0 });
    expect((newSkillRow?.embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    const occupationsUpsert = upserts.find((u) => u.table === "occupations");
    expect((occupationsUpsert?.rows[0].embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    expect(result.skipped.map((s) => s.file)).toEqual(["sources.csv", "exposure.csv"]);
  });

  it("does not clobber label_ms / is_green / base_importance for a skill that already exists", async () => {
    const { client, upserts } = fakeSupabase({
      skills: [
        {
          id: "s1",
          label_en: "Data analysis",
          label_ms: "Analisis data",
          is_green: true,
          base_importance: 7,
          embedding: vector(1),
        },
      ],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      skills: [{ id: "s1", escoUri: "https://data.europa.eu/esco/skill/s1", labelEn: "Data analysis" }],
    };

    await applyImport(input, client, embedder);

    const skillsUpserts = upserts.filter((u) => u.table === "skills");
    const existingSkillRow = skillsUpserts.flatMap((u) => u.rows).find((row) => row.id === "s1");
    expect(existingSkillRow).toEqual({
      id: "s1",
      esco_uri: "https://data.europa.eu/esco/skill/s1",
      label_en: "Data analysis",
      embedding: vector(1),
    });
    expect(existingSkillRow).not.toHaveProperty("label_ms");
    expect(existingSkillRow).not.toHaveProperty("is_green");
    expect(existingSkillRow).not.toHaveProperty("base_importance");
  });

  it("reports a table error instead of throwing when Supabase rejects a row", async () => {
    const client = {
      from() {
        return {
          upsert() {
            return Promise.resolve({ error: { message: "duplicate key value" } });
          },
          select() {
            return { in() { return Promise.resolve({ data: [] }); } };
          },
        };
      },
    } as unknown as SupabaseClient;
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      courses: [
        {
          id: "c001",
          title: "t",
          provider: "p",
          url: "https://example.com",
          languages: ["en"],
          hours: 1,
          costType: "free",
          certificate: true,
          skillIds: [],
          lastChecked: "2026-10-01",
          mode: "online",
        },
      ],
    };

    const result = await applyImport(input, client, embedder);
    const coursesResult = result.tables.find((t) => t.table === "courses");
    expect(coursesResult).toMatchObject({ upserted: 0, error: "duplicate key value" });
  });

  it("chunks a large upsert into batches of 500 rows", async () => {
    const { client, upserts } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const courses = Array.from({ length: 1200 }, (_, i) => ({
      id: `c${i}`,
      title: "t",
      provider: "p",
      url: "https://example.com",
      languages: ["en" as const],
      hours: 1,
      costType: "free" as const,
      certificate: true,
      skillIds: [],
      lastChecked: "2026-10-01",
      mode: "online" as const,
    }));

    const result = await applyImport({ ...EMPTY_INPUT, courses }, client, embedder);

    const coursesUpserts = upserts.filter((u) => u.table === "courses");
    expect(coursesUpserts).toHaveLength(3);
    expect(coursesUpserts.map((u) => u.rows.length)).toEqual([500, 500, 200]);
    expect(result.tables.find((t) => t.table === "courses")).toMatchObject({ upserted: 1200 });
  });

  it("upserts signals onConflict skill_id,source,metric,window_end and never sends an id", async () => {
    const { client, upserts } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = { ...EMPTY_INPUT, signals: [signalRow()] };
    const result = await applyImport(input, client, embedder);

    const signalsUpsert = upserts.find((u) => u.table === "signals");
    expect(signalsUpsert?.onConflict).toBe(SIGNALS_ON_CONFLICT);
    expect(signalsUpsert?.rows).toEqual([signalRow()]);
    expect(signalsUpsert?.rows[0]).not.toHaveProperty("id");
    expect(result.tables.find((t) => t.table === "signals")).toMatchObject({ upserted: 1 });
  });

  it("reports 'apply migration 20261021150000 first' when signals_reading_key doesn't exist yet, without aborting other tables", async () => {
    const client = {
      from(table: string) {
        return {
          upsert() {
            if (table === "signals") {
              return Promise.resolve({
                error: {
                  code: "42P10",
                  message: "there is no unique or exclusion constraint matching the ON CONFLICT specification",
                },
              });
            }
            return Promise.resolve({ error: null });
          },
          select() {
            return { in() { return Promise.resolve({ data: [] }); } };
          },
        };
      },
    } as unknown as SupabaseClient;
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      signals: [signalRow()],
      occupations: [
        {
          id: "o001",
          escoUri: null,
          iscoCode: "2512",
          titleEn: "Data Analyst",
          titleMs: "Penganalisis Data",
          description: "Analyses data.",
          cluster: "data_analytics",
          isEmerging: false,
          lastChecked: "2026-10-01",
          notes: "",
        },
      ],
    };

    const result = await applyImport(input, client, embedder);

    const signalsResult = result.tables.find((t) => t.table === "signals");
    expect(signalsResult?.error).toMatch(/apply migration 20261021150000 first/);

    // The signals upsert failing must not stop other tables from being reported.
    const occupationsResult = result.tables.find((t) => t.table === "occupations");
    expect(occupationsResult).toMatchObject({ upserted: 1 });
  });
});
