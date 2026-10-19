import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS } from "../../src/types/contracts";
import { applyImport, computeEmbeddingsWithReuse, type ApplyInput } from "./apply";
import type { Embedder } from "./clients";

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i / 1000);
}

/** A minimal fake Supabase client: just enough of .from().upsert()/.select().in() to drive apply.ts. */
function fakeSupabase(existingByTable: Record<string, Record<string, unknown>[]> = {}) {
  const upserts: { table: string; rows: Record<string, unknown>[] }[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: Record<string, unknown>[]) {
          upserts.push({ table, rows });
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

describe("computeEmbeddingsWithReuse", () => {
  it("embeds every row when the table is empty, in one batched call", async () => {
    const { client } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const result = await computeEmbeddingsWithReuse(
      client,
      "skills",
      "label_en",
      [
        { id: "s1", text: "Data analysis" },
        { id: "s2", text: "Communication" },
      ],
      embedder
    );

    expect(embedder).toHaveBeenCalledTimes(1);
    expect(embedder).toHaveBeenCalledWith(["Data analysis", "Communication"]);
    expect(result.get("s1")).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(result.get("s2")).toHaveLength(EMBEDDING_DIMENSIONS);
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
      "label_en",
      [{ id: "s1", text: "Data analysis" }],
      embedder
    );

    expect(embedder).not.toHaveBeenCalled();
    expect(result.get("s1")).toEqual(stored);
  });

  it("re-embeds when the text changed, even if a row already exists", async () => {
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Old label", embedding: vector(1) }],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(50 + i)));

    const result = await computeEmbeddingsWithReuse(
      client,
      "skills",
      "label_en",
      [{ id: "s1", text: "New label" }],
      embedder
    );

    expect(embedder).toHaveBeenCalledWith(["New label"]);
    expect(result.get("s1")).toEqual(vector(50));
  });
});

const EMPTY_INPUT: ApplyInput = { courses: [], programmes: [], occupations: [], skills: [] };

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
      },
    ]);

    const skillsUpsert = upserts.find((u) => u.table === "skills");
    expect(skillsUpsert?.rows[0]).toMatchObject({ id: "00000000-0000-0000-0000-000000000001", label_ms: "Data analysis" });
    expect((skillsUpsert?.rows[0].embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    const occupationsUpsert = upserts.find((u) => u.table === "occupations");
    expect((occupationsUpsert?.rows[0].embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    expect(result.skipped.map((s) => s.file)).toEqual(["sources.csv", "keywords.csv", "exposure.csv"]);
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
        },
      ],
    };

    const result = await applyImport(input, client, embedder);
    const coursesResult = result.tables.find((t) => t.table === "courses");
    expect(coursesResult).toMatchObject({ upserted: 0, error: "duplicate key value" });
  });
});
