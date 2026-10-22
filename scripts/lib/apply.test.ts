import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS } from "../../src/types/contracts";
import {
  applyImport,
  buildExposureRows,
  buildSourceRows,
  planEmbeddings,
  fillEmbeddings,
  EMBED_BATCH_SIZE,
  computeWouldWriteCounts,
  buildSkillRows,
  buildOccupationSkillRows,
  DEFAULT_BASE_IMPORTANCE,
  OCCUPATION_SKILLS_ON_CONFLICT,
  occupationEmbeddingText,
  skillEmbeddingText,
  EXPOSURE_ON_CONFLICT,
  SIGNALS_ON_CONFLICT,
  SOURCES_ON_CONFLICT,
  type ApplyInput,
  type SignalRow,
} from "./apply";
import { EmbeddingQuotaExceededError } from "./embedding-quota";
import type { Embedder } from "./clients";
import type { ExposureRow, OccupationRow, OccupationSkillRow, SourceRow } from "./row-schemas";
import { roleFitScore, skillImportance } from "../../src/lib/scoring";

describe("buildSkillRows base_importance", () => {
  it("seeds new skills with a weight that gives a non-zero fit", () => {
    const { newRows } = buildSkillRows(
      [
        { id: "s1", escoUri: "http://data.europa.eu/esco/skill/s1", labelEn: "perform data analysis" },
        { id: "s2", escoUri: "http://data.europa.eu/esco/skill/s2", labelEn: "use spreadsheets software" },
      ],
      new Set(),
      new Map()
    );
    const base = newRows.map((row) => row.base_importance as number);
    expect(base).toEqual([DEFAULT_BASE_IMPORTANCE, DEFAULT_BASE_IMPORTANCE]);

    // A user who has one of two essential skills, with no trend momentum,
    // should fit 50%. With base_importance 0 this was 0 for every role.
    const fit = roleFitScore([
      { importance: skillImportance(base[0], 0), level: 1 },
      { importance: skillImportance(base[1], 0), level: 0 },
    ]);
    expect(fit).toBeCloseTo(0.5);
  });
});

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i / 1000);
}

/** A minimal fake Supabase client: just enough of .from().upsert()/.update().eq()/.select().in() to drive apply.ts. */
function fakeSupabase(existingByTable: Record<string, Record<string, unknown>[]> = {}) {
  const upserts: { table: string; rows: Record<string, unknown>[]; onConflict?: string }[] = [];
  const updates: { table: string; set: Record<string, unknown>; column: string; value: unknown }[] = [];
  // Ordered log of both upsert and update calls, so tests can check relative ordering across the two.
  const calls: { type: "upsert" | "update"; table: string }[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: Record<string, unknown>[], options?: { onConflict?: string }) {
          upserts.push({ table, rows, onConflict: options?.onConflict });
          calls.push({ type: "upsert", table });
          return Promise.resolve({ error: null });
        },
        update(set: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              updates.push({ table, set, column, value });
              calls.push({ type: "update", table });
              return Promise.resolve({ error: null });
            },
          };
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
  return { client: client as unknown as SupabaseClient, upserts, updates, calls };
}

const SKILL_SELECT = "id, label_en, embedding";
const rebuildSkillText = (row: Record<string, unknown>) =>
  skillEmbeddingText({ labelEn: String(row.label_en ?? "") });

describe("planEmbeddings", () => {
  it("sends every row to toEmbed when the table is empty, with nothing to reuse", async () => {
    const { client } = fakeSupabase({});

    const result = await planEmbeddings(client, "skills", SKILL_SELECT, rebuildSkillText, [
      { id: "s1", text: "Data analysis" },
      { id: "s2", text: "Communication" },
    ]);

    expect(result.toEmbed).toEqual([
      { id: "s1", text: "Data analysis" },
      { id: "s2", text: "Communication" },
    ]);
    expect(result.rowEmbeddings.size).toBe(0);
    expect(result.existingIds.size).toBe(0);
  });

  it("resumes: skips a row whose text is unchanged and already has a stored vector", async () => {
    const stored = vector(7);
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Data analysis", embedding: stored }],
    });

    const result = await planEmbeddings(client, "skills", SKILL_SELECT, rebuildSkillText, [
      { id: "s1", text: "Data analysis" },
    ]);

    expect(result.toEmbed).toEqual([]);
    expect(result.rowEmbeddings.get("s1")).toEqual(stored);
    expect(result.existingIds).toEqual(new Set(["s1"]));
  });

  it("re-embeds when the text changed, even if a row already exists", async () => {
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Old label", embedding: vector(1) }],
    });

    const result = await planEmbeddings(client, "skills", SKILL_SELECT, rebuildSkillText, [
      { id: "s1", text: "New label" },
    ]);

    expect(result.toEmbed).toEqual([{ id: "s1", text: "New label" }]);
  });

  it("does not preserve the old vector for a changed-text row, so the base-row write nulls it out", async () => {
    const stale = vector(1);
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Old label", embedding: stale }],
    });

    const result = await planEmbeddings(client, "skills", SKILL_SELECT, rebuildSkillText, [
      { id: "s1", text: "New label" },
    ]);

    // Still queued for a fresh embedding...
    expect(result.toEmbed).toEqual([{ id: "s1", text: "New label" }]);
    // ...and has no entry to reuse, so buildSkillRows/buildOccupationRows
    // write null for it instead of the old (now-wrong-for-the-text) vector —
    // otherwise a rerun after quota exhaustion would see a valid vector and
    // skip this row forever, even though it was never re-embedded.
    expect(result.rowEmbeddings.has("s1")).toBe(false);
  });

  it("queues a row for embedding with nothing to preserve when the stored embedding is missing or the wrong size", async () => {
    const { client } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Data analysis", embedding: null }],
    });

    const result = await planEmbeddings(client, "skills", SKILL_SELECT, rebuildSkillText, [
      { id: "s1", text: "Data analysis" },
    ]);

    expect(result.toEmbed).toEqual([{ id: "s1", text: "Data analysis" }]);
    expect(result.rowEmbeddings.has("s1")).toBe(false);
  });

  it("reuses a stored occupation embedding when title_en + description together are unchanged", async () => {
    const stored = vector(3);
    const { client } = fakeSupabase({
      occupations: [
        { id: "o1", title_en: "Data Analyst", description: "Analyses data.", embedding: stored },
      ],
    });

    const occupation = { titleEn: "Data Analyst", description: "Analyses data." };
    const result = await planEmbeddings(
      client,
      "occupations",
      "id, title_en, description, embedding",
      (row) =>
        occupationEmbeddingText({ titleEn: String(row.title_en ?? ""), description: String(row.description ?? "") }),
      [{ id: "o1", text: occupationEmbeddingText(occupation) }]
    );

    expect(result.toEmbed).toEqual([]);
    expect(result.rowEmbeddings.get("o1")).toEqual(stored);
  });

  it("re-embeds an occupation when only the description changed (title_en alone still matches)", async () => {
    const { client } = fakeSupabase({
      occupations: [
        { id: "o1", title_en: "Data Analyst", description: "Old description.", embedding: vector(1) },
      ],
    });

    const occupation = { titleEn: "Data Analyst", description: "New description." };
    const result = await planEmbeddings(
      client,
      "occupations",
      "id, title_en, description, embedding",
      (row) =>
        occupationEmbeddingText({ titleEn: String(row.title_en ?? ""), description: String(row.description ?? "") }),
      [{ id: "o1", text: occupationEmbeddingText(occupation) }]
    );

    expect(result.toEmbed).toEqual([{ id: "o1", text: occupationEmbeddingText(occupation) }]);
  });
});

describe("fillEmbeddings", () => {
  it("writes each batch as soon as it's computed, in batches of EMBED_BATCH_SIZE", async () => {
    const { client, updates } = fakeSupabase({});
    const toEmbed = Array.from({ length: EMBED_BATCH_SIZE + 10 }, (_, i) => ({ id: `s${i}`, text: `text ${i}` }));
    const embedCalls: string[][] = [];
    const embedder: Embedder = vi.fn(async (texts: string[]) => {
      embedCalls.push(texts);
      return texts.map((_, i) => vector(i));
    });

    const result = await fillEmbeddings(client, "skills", toEmbed, embedder);

    expect(result).toEqual({
      table: "skills",
      total: EMBED_BATCH_SIZE + 10,
      done: EMBED_BATCH_SIZE + 10,
      remaining: 0,
      stoppedByQuota: false,
    });
    expect(embedCalls).toHaveLength(2);
    expect(embedCalls[0]).toHaveLength(EMBED_BATCH_SIZE);
    expect(embedCalls[1]).toHaveLength(10);
    const skillsUpdates = updates.filter((u) => u.table === "skills");
    expect(skillsUpdates).toHaveLength(EMBED_BATCH_SIZE + 10);
    expect(skillsUpdates.map((u) => u.value)).toEqual(toEmbed.map((row) => row.id));
    expect(skillsUpdates.every((u) => u.column === "id")).toBe(true);
    expect((skillsUpdates[0].set.embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);
  });

  it("writes each row's embedding with update(...).eq('id', ...), never insert/upsert", async () => {
    const { client, upserts, updates } = fakeSupabase({});
    const toEmbed = [{ id: "s1", text: "a" }, { id: "s2", text: "b" }];
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    await fillEmbeddings(client, "skills", toEmbed, embedder);

    expect(upserts.filter((u) => u.table === "skills")).toHaveLength(0);
    const skillsUpdates = updates.filter((u) => u.table === "skills");
    expect(skillsUpdates).toEqual([
      { table: "skills", set: { embedding: vector(0) }, column: "id", value: "s1" },
      { table: "skills", set: { embedding: vector(1) }, column: "id", value: "s2" },
    ]);
  });

  it("stops cleanly on a daily/non-recoverable quota, keeping already-written batches and reporting done/remaining", async () => {
    const { client, updates } = fakeSupabase({});
    const toEmbed = Array.from({ length: EMBED_BATCH_SIZE + 10 }, (_, i) => ({ id: `s${i}`, text: `text ${i}` }));
    let calls = 0;
    const embedder: Embedder = vi.fn(async (texts: string[]) => {
      calls += 1;
      if (calls === 2) throw new EmbeddingQuotaExceededError("Gemini daily embedding quota exceeded");
      return texts.map((_, i) => vector(i));
    });

    const result = await fillEmbeddings(client, "skills", toEmbed, embedder);

    expect(result).toEqual({
      table: "skills",
      total: EMBED_BATCH_SIZE + 10,
      done: EMBED_BATCH_SIZE,
      remaining: 10,
      stoppedByQuota: true,
    });
    // The first, successful batch must already be durable.
    expect(updates.filter((u) => u.table === "skills")).toHaveLength(EMBED_BATCH_SIZE);
  });

  it("lets a non-quota error propagate instead of swallowing it", async () => {
    const { client } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(fillEmbeddings(client, "skills", [{ id: "s1", text: "x" }], embedder)).rejects.toThrow(
      "network down"
    );
  });
});

const EMPTY_INPUT: ApplyInput = {
  courses: [],
  programmes: [],
  occupations: [],
  skills: [],
  signals: [],
  sources: [],
  exposure: [],
  occupationSkills: [],
  demand: [],
  scenarios: [],
};

function sourceRow(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    name: "ILO GenAI Exposure 2025",
    url: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf",
    publisher: "ILO",
    whatItMeasures: "Exposure scores by ISCO-08",
    updateFrequency: "Periodic",
    lastUpdated: "2025-05-20",
    dataFormat: "PDF",
    licence: "CC BY 4.0",
    useFor: "exposure",
    notes: "",
    ...overrides,
  };
}

function exposureRow(overrides: Partial<ExposureRow> = {}): ExposureRow {
  return {
    occupation: "software developer",
    code: "2512",
    exposureValue: 0.53,
    scale: "0-1 (mean task score)",
    sourceName: "ILO GenAI Exposure 2025",
    sourceUrl: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf",
    tableOrPage: "Table A1, p.49",
    asOf: "2025-05-20",
    notes: "",
    ...overrides,
  };
}

function occupationRow(overrides: Partial<OccupationRow> = {}): OccupationRow {
  return {
    id: "o001",
    escoUri: "http://data.europa.eu/esco/occupation/f2b15a0e-e65a-438a-affb-29b9d50b77d1",
    iscoCode: "2512",
    titleEn: "software developer",
    titleMs: "pembangun perisian",
    description: "Writes software.",
    cluster: "ai_digital",
    isEmerging: false,
    lastChecked: "2026-10-20",
    notes: "",
    ...overrides,
  };
}

describe("buildSourceRows", () => {
  it("maps SourceRow camelCase fields to public.sources snake_case columns", () => {
    expect(buildSourceRows([sourceRow()])).toEqual([
      {
        name: "ILO GenAI Exposure 2025",
        url: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf",
        publisher: "ILO",
        what_it_measures: "Exposure scores by ISCO-08",
        update_frequency: "Periodic",
        last_updated: "2025-05-20",
        data_format: "PDF",
        licence: "CC BY 4.0",
        use_for: "exposure",
        notes: "",
      },
    ]);
  });
});

describe("buildExposureRows", () => {
  it("fills occupation_id from an exact title_en match", () => {
    const occupations = [occupationRow()];
    const rows = buildExposureRows([exposureRow()], occupations);
    expect(rows[0]).toMatchObject({ occupation_id: "o001", occupation: "software developer", code: "2512" });
  });

  it("falls back to a unique isco_code match when the title doesn't match", () => {
    const occupations = [occupationRow({ titleEn: "some other title" })];
    const rows = buildExposureRows([exposureRow()], occupations);
    expect(rows[0].occupation_id).toBe("o001");
  });

  it("falls back to an esco_uri match when code is an ESCO URI", () => {
    const occupations = [occupationRow({ titleEn: "some other title", iscoCode: null })];
    const rows = buildExposureRows(
      [exposureRow({ code: "http://data.europa.eu/esco/occupation/f2b15a0e-e65a-438a-affb-29b9d50b77d1" })],
      occupations
    );
    expect(rows[0].occupation_id).toBe("o001");
  });

  it("never invents an occupation_id when the code matches more than one occupation", () => {
    const occupations = [
      occupationRow({ id: "o001", titleEn: "data analyst", iscoCode: "2511" }),
      occupationRow({ id: "o002", titleEn: "data scientist", iscoCode: "2511" }),
    ];
    const rows = buildExposureRows([exposureRow({ occupation: "unmatched title", code: "2511" })], occupations);
    expect(rows[0].occupation_id).toBeNull();
  });

  it("sets occupation_id to null when nothing matches", () => {
    const rows = buildExposureRows([exposureRow({ occupation: "nobody", code: "0000" })], [occupationRow()]);
    expect(rows[0].occupation_id).toBeNull();
  });

  it("maps ExposureRow camelCase fields to public.exposure snake_case columns", () => {
    const rows = buildExposureRows([exposureRow()], [occupationRow()]);
    expect(rows).toEqual([
      {
        occupation_id: "o001",
        occupation: "software developer",
        code: "2512",
        exposure_value: 0.53,
        scale: "0-1 (mean task score)",
        source_name: "ILO GenAI Exposure 2025",
        source_url: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf",
        table_or_page: "Table A1, p.49",
        as_of: "2025-05-20",
        notes: "",
      },
    ]);
  });
});

describe("computeWouldWriteCounts", () => {
  it("counts every target table from the same builders --apply uses", () => {
    const counts = computeWouldWriteCounts({
      ...EMPTY_INPUT,
      courses: [],
      occupations: [occupationRow()],
      sources: [sourceRow()],
      exposure: [exposureRow()],
      occupationSkills: [occupationSkillRow(), occupationSkillRow({ relation: "optional" })],
    });
    expect(counts).toEqual({
      skills: 0,
      occupations: 1,
      sources: 1,
      exposure: 1,
      cluster_demand: 0,
      scenarios: 0,
      courses: 0,
      programs: 0,
      signals: 0,
      occupation_skills: 2,
    });
  });
});

function occupationSkillRow(overrides: Partial<OccupationSkillRow> = {}): OccupationSkillRow {
  return {
    occupationId: "o001",
    skillUri: "http://data.europa.eu/esco/skill/21D2F96D-35f7-4e3f-9745-c533d2dd6e97",
    skillLabel: "computer programming",
    relation: "essential",
    sourceName: "ESCO",
    asOf: "2026-10-21",
    ...overrides,
  };
}

describe("buildOccupationSkillRows", () => {
  it("uses the same skill id as the skills table (lower-case UUID from the URI)", () => {
    expect(buildOccupationSkillRows([occupationSkillRow()])).toEqual([
      { occupation_id: "o001", skill_id: "21d2f96d-35f7-4e3f-9745-c533d2dd6e97", relation: "essential" },
    ]);
  });

  it("upserts occupation_skills onConflict occupation_id,skill_id, after skills/occupations are written but before their embeddings are filled in", async () => {
    const { client, upserts, calls } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    await applyImport(
      {
        ...EMPTY_INPUT,
        occupations: [occupationRow()],
        skills: [
          {
            id: "21d2f96d-35f7-4e3f-9745-c533d2dd6e97",
            escoUri: "http://data.europa.eu/esco/skill/21d2f96d-35f7-4e3f-9745-c533d2dd6e97",
            labelEn: "computer programming",
          },
        ],
        occupationSkills: [occupationSkillRow()],
      },
      client,
      embedder
    );

    const linkIndex = calls.findIndex((c) => c.type === "upsert" && c.table === "occupation_skills");
    // skills and occupations are each written twice: once with the catalogue
    // row (before any embedding call, an upsert), once more (an update) to
    // fill in the embedding.
    expect(calls.findIndex((c) => c.type === "upsert" && c.table === "skills")).toBeLessThan(linkIndex);
    expect(calls.findIndex((c) => c.type === "upsert" && c.table === "occupations")).toBeLessThan(linkIndex);
    expect(linkIndex).toBeLessThan(calls.findIndex((c) => c.type === "update" && c.table === "skills"));
    expect(linkIndex).toBeLessThan(calls.findIndex((c) => c.type === "update" && c.table === "occupations"));
    expect(upserts.find((u) => u.table === "occupation_skills")?.onConflict).toBe(OCCUPATION_SKILLS_ON_CONFLICT);
    expect(OCCUPATION_SKILLS_ON_CONFLICT).toBe("occupation_id,skill_id");
  });
});

function signalRow(overrides: Partial<SignalRow> = {}): SignalRow {
  return {
    skill_id: "00000000-0000-0000-0000-000000000001",
    source: "arXiv",
    metric: "arxiv_papers_90d",
    value: 10,
    window_start: "2026-07-01",
    window_end: "2026-10-01",
    as_of: "2026-10-01",
    url: "https://export.arxiv.org/api/query?search_query=all%3A%28test%29",
    keywords: ["test"],
    ...overrides,
  };
}

describe("applyImport", () => {
  it("upserts courses, programs, skills, and occupations with snake_case columns", async () => {
    const { client, upserts, updates } = fakeSupabase({});
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

    // A brand-new skill: the main upsert gets defaults for the NOT NULL
    // columns (neutral importance, not 0) with no embedding yet...
    const skillsUpserts = upserts.filter((u) => u.table === "skills");
    const newSkillRow = skillsUpserts.flatMap((u) => u.rows).find((row) => row.id === "00000000-0000-0000-0000-000000000001");
    expect(newSkillRow).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      label_ms: "Data analysis",
      is_green: false,
      base_importance: DEFAULT_BASE_IMPORTANCE,
    });

    // ...and a brand-new row's base write leaves it null...
    expect(newSkillRow?.embedding).toBeNull();
    // ...and a later update (fillEmbeddings) sets the embedding once computed.
    const embeddedSkillUpdate = updates.find(
      (u) => u.table === "skills" && u.column === "id" && u.value === "00000000-0000-0000-0000-000000000001"
    );
    expect((embeddedSkillUpdate?.set.embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    const embeddedOccupationUpdate = updates.find(
      (u) => u.table === "occupations" && u.column === "id" && u.value === "o001"
    );
    expect((embeddedOccupationUpdate?.set.embedding as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    expect(result.skipped).toEqual([]);
  });

  it("does not clobber label_ms / is_green / base_importance for a skill that already exists", async () => {
    const { client, upserts, updates } = fakeSupabase({
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

    // Existing skills must never go through upsert with a partial column
    // set: Postgres checks every NOT NULL column (label_ms, base_importance,
    // is_green) on the proposed INSERT row before it even looks at the
    // conflict, so a partial-column upsert fails live even though the row
    // already exists.
    expect(upserts.filter((u) => u.table === "skills")).toHaveLength(0);

    const skillUpdates = updates.filter((u) => u.table === "skills" && u.value === "s1");
    expect(skillUpdates).toHaveLength(1);
    expect(skillUpdates[0].column).toBe("id");
    expect(skillUpdates[0].set).toEqual({
      esco_uri: "https://data.europa.eu/esco/skill/s1",
      label_en: "Data analysis",
      embedding: vector(1),
    });
    expect(skillUpdates[0].set).not.toHaveProperty("label_ms");
    expect(skillUpdates[0].set).not.toHaveProperty("is_green");
    expect(skillUpdates[0].set).not.toHaveProperty("base_importance");
  });

  it("a rerun over skills that already exist never upserts a partial column set: only update().eq('id') for existing rows, upsert only for new rows with every NOT NULL column filled", async () => {
    const { client, upserts, updates } = fakeSupabase({
      skills: [
        { id: "s1", label_en: "Data analysis", label_ms: "Analisis data", is_green: true, base_importance: 7, embedding: vector(1) },
        { id: "s2", label_en: "Communication", label_ms: "Komunikasi", is_green: false, base_importance: 3, embedding: vector(2) },
      ],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      skills: [
        { id: "s1", escoUri: "https://data.europa.eu/esco/skill/s1", labelEn: "Data analysis" },
        { id: "s2", escoUri: "https://data.europa.eu/esco/skill/s2", labelEn: "Communication" },
        { id: "s3", escoUri: "https://data.europa.eu/esco/skill/s3", labelEn: "Teamwork" },
      ],
    };

    await applyImport(input, client, embedder);

    // Not one skills upsert carries a partial column set: the only skills
    // upsert is the brand-new row s3, with every NOT NULL column filled.
    const skillsUpserts = upserts.filter((u) => u.table === "skills");
    const upsertedRows = skillsUpserts.flatMap((u) => u.rows);
    expect(upsertedRows.map((row) => row.id)).toEqual(["s3"]);
    expect(upsertedRows[0]).toMatchObject({
      id: "s3",
      esco_uri: "https://data.europa.eu/esco/skill/s3",
      label_en: "Teamwork",
      label_ms: "Teamwork",
      is_green: false,
      base_importance: DEFAULT_BASE_IMPORTANCE,
    });

    // s1 and s2 (already existing) are each written via update().eq('id'),
    // never upsert, and only with the columns this importer owns. s3 is
    // brand new, so its only update (if any) comes from fillEmbeddings —
    // identifiable because it sets nothing but embedding.
    const skillUpdates = updates.filter((u) => u.table === "skills");
    const baseRowUpdates = skillUpdates.filter((u) => "esco_uri" in u.set);
    expect(baseRowUpdates.map((u) => u.value).sort()).toEqual(["s1", "s2"]);
    for (const update of baseRowUpdates) {
      expect(update.column).toBe("id");
      expect(Object.keys(update.set).sort()).toEqual(["embedding", "esco_uri", "label_en"]);
    }
    expect(skillUpdates.every((u) => u.value !== "s3" || Object.keys(u.set).sort().join() === "embedding")).toBe(
      true
    );
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
          update() {
            return { eq() { return Promise.resolve({ error: null }); } };
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

  it("upserts sources onConflict name and exposure onConflict occupation,source_name, sources before exposure", async () => {
    const { client, upserts } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      occupations: [occupationRow()],
      sources: [sourceRow()],
      exposure: [exposureRow()],
    };
    const result = await applyImport(input, client, embedder);

    const sourcesUpsertIndex = upserts.findIndex((u) => u.table === "sources");
    const exposureUpsertIndex = upserts.findIndex((u) => u.table === "exposure");
    expect(sourcesUpsertIndex).toBeGreaterThanOrEqual(0);
    expect(sourcesUpsertIndex).toBeLessThan(exposureUpsertIndex);

    expect(upserts[sourcesUpsertIndex].onConflict).toBe(SOURCES_ON_CONFLICT);
    expect(upserts[exposureUpsertIndex].onConflict).toBe(EXPOSURE_ON_CONFLICT);
    expect(upserts[exposureUpsertIndex].rows[0]).toMatchObject({ occupation_id: "o001", source_name: "ILO GenAI Exposure 2025" });

    expect(result.tables.find((t) => t.table === "sources")).toMatchObject({ upserted: 1 });
    expect(result.tables.find((t) => t.table === "exposure")).toMatchObject({ upserted: 1 });
    expect(result.skipped).toEqual([]);
  });

  it("every exposure row's source_name is a name built into the sources rows upserted in the same call", async () => {
    const { client, upserts } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      occupations: [occupationRow()],
      sources: [sourceRow()],
      exposure: [exposureRow(), exposureRow({ occupation: "web developer", code: "2513" })],
    };
    await applyImport(input, client, embedder);

    const sourceNames = new Set(upserts.find((u) => u.table === "sources")?.rows.map((row) => row.name));
    const exposureRows = upserts.find((u) => u.table === "exposure")?.rows ?? [];
    expect(exposureRows.length).toBeGreaterThan(0);
    for (const row of exposureRows) {
      expect(sourceNames.has(row.source_name as string)).toBe(true);
    }
  });

  it("resumes: never calls the embedder for a skill/occupation whose text is unchanged and already has a vector", async () => {
    const storedSkillEmbedding = vector(1);
    const storedOccupationEmbedding = vector(2);
    const { client, upserts, updates } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Data analysis", embedding: storedSkillEmbedding }],
      occupations: [
        { id: "o001", title_en: "software developer", description: "Writes software.", embedding: storedOccupationEmbedding },
      ],
    });
    const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map((_, i) => vector(99 + i)));

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      skills: [{ id: "s1", escoUri: "https://data.europa.eu/esco/skill/s1", labelEn: "Data analysis" }],
      occupations: [occupationRow({ id: "o001", description: "Writes software." })],
    };

    const result = await applyImport(input, client, embedder);

    expect(embedder).not.toHaveBeenCalled();
    expect(result.embeddings).toEqual([
      { table: "skills", total: 0, done: 0, remaining: 0, stoppedByQuota: false },
      { table: "occupations", total: 0, done: 0, remaining: 0, stoppedByQuota: false },
    ]);
    // s1 already exists: written via update, never a partial-column upsert.
    expect(upserts.filter((u) => u.table === "skills")).toHaveLength(0);
    const skillUpdate = updates.find((u) => u.table === "skills" && u.value === "s1");
    const occupationRowUpserted = upserts
      .filter((u) => u.table === "occupations")
      .flatMap((u) => u.rows)
      .find((r) => r.id === "o001");
    expect(skillUpdate?.set.embedding).toEqual(storedSkillEmbedding);
    expect(occupationRowUpserted?.embedding).toEqual(storedOccupationEmbedding);
  });

  it("a changed-text row whose embedding batch never ran (quota exhausted first) is re-embedded on rerun, not skipped", async () => {
    // Run 1: s1's text changed ("Old label" -> "New label"); the quota is
    // exhausted immediately, so s1's batch is never even attempted.
    const { client: run1Client, upserts: run1Upserts, updates: run1Updates } = fakeSupabase({
      skills: [{ id: "s1", label_en: "Old label", embedding: vector(1) }],
    });
    const quotaExceeded: Embedder = vi.fn(async () => {
      throw new EmbeddingQuotaExceededError("Gemini daily embedding quota exceeded");
    });
    const input: ApplyInput = {
      ...EMPTY_INPUT,
      skills: [{ id: "s1", escoUri: "https://data.europa.eu/esco/skill/s1", labelEn: "New label" }],
    };

    const run1Result = await applyImport(input, run1Client, quotaExceeded);

    expect(run1Result.embeddings[0]).toMatchObject({ table: "skills", done: 0, remaining: 1, stoppedByQuota: true });
    // s1 already exists: the base-row write goes through update, not
    // upsert, and still stores the new text while nulling the embedding
    // rather than keeping the old (now text-mismatched) vector.
    expect(run1Upserts.filter((u) => u.table === "skills")).toHaveLength(0);
    const run1SkillUpdate = run1Updates.find((u) => u.table === "skills" && u.value === "s1");
    expect(run1SkillUpdate?.set).toMatchObject({ label_en: "New label", embedding: null });

    // Run 2 (rerun): a fresh fake DB reflecting exactly what run 1 wrote.
    const { client: run2Client, updates: run2Updates } = fakeSupabase({
      skills: [{ id: "s1", label_en: "New label", embedding: null }],
    });
    const freshVector = vector(5);
    const succeedingEmbedder: Embedder = vi.fn(async (texts: string[]) => texts.map(() => freshVector));

    const run2Result = await applyImport(input, run2Client, succeedingEmbedder);

    // s1 was not skipped: it was sent to the embedder and its fresh vector written.
    expect(succeedingEmbedder).toHaveBeenCalledWith(["New label"]);
    expect(run2Result.embeddings[0]).toMatchObject({ table: "skills", done: 1, remaining: 0, stoppedByQuota: false });
    // Two updates for s1: the base-row write (still existing, still null
    // embedding since nothing to reuse) and then fillEmbeddings's own write
    // of the freshly computed vector.
    const run2SkillUpdates = run2Updates.filter((u) => u.table === "skills" && u.value === "s1");
    expect(run2SkillUpdates).toEqual([
      { table: "skills", set: { esco_uri: "https://data.europa.eu/esco/skill/s1", label_en: "New label", embedding: null }, column: "id", value: "s1" },
      { table: "skills", set: { embedding: freshVector }, column: "id", value: "s1" },
    ]);
  });

  it("writes every non-embedding table even when the embedder fails immediately, and reports the quota stop", async () => {
    const { client, upserts } = fakeSupabase({});
    const embedder: Embedder = vi.fn(async () => {
      throw new EmbeddingQuotaExceededError("Gemini daily embedding quota exceeded: limit 100");
    });

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      skills: [{ id: "s1", escoUri: "https://data.europa.eu/esco/skill/s1", labelEn: "Data analysis" }],
      occupations: [occupationRow()],
      sources: [sourceRow()],
      exposure: [exposureRow()],
      signals: [signalRow()],
      occupationSkills: [occupationSkillRow({ occupationId: "o001", skillUri: "https://data.europa.eu/esco/skill/s1" })],
    };

    const result = await applyImport(input, client, embedder);

    // Every non-embedding table still landed, with no error.
    for (const table of ["sources", "exposure", "signals", "occupation_skills"]) {
      const tableResult = result.tables.find((t) => t.table === table);
      expect(tableResult).toMatchObject({ upserted: 1 });
      expect(tableResult?.error).toBeUndefined();
    }
    // Both skills and occupations rows are still written (with embedding null: brand new rows, nothing to preserve).
    expect(result.tables.find((t) => t.table === "skills")).toMatchObject({ upserted: 1 });
    expect(result.tables.find((t) => t.table === "occupations")).toMatchObject({ upserted: 1 });
    const skillRow = upserts.filter((u) => u.table === "skills")[0]?.rows[0];
    expect(skillRow?.embedding).toBeNull();

    // Embedding itself stopped immediately; occupations is never even attempted once skills has already hit the quota.
    expect(result.embeddings).toEqual([
      { table: "skills", total: 1, done: 0, remaining: 1, stoppedByQuota: true },
      { table: "occupations", total: 1, done: 0, remaining: 1, stoppedByQuota: true },
    ]);
    expect(embedder).toHaveBeenCalledTimes(1);
  });

  it("stops embedding partway through a large skills batch on a quota error, with every table already written", async () => {
    const { client, updates } = fakeSupabase({});
    const skillCount = EMBED_BATCH_SIZE + 5;
    const skills = Array.from({ length: skillCount }, (_, i) => ({
      id: `s${i}`,
      escoUri: `https://data.europa.eu/esco/skill/s${i}`,
      labelEn: `skill ${i}`,
    }));
    let embedCalls = 0;
    const embedder: Embedder = vi.fn(async (texts: string[]) => {
      embedCalls += 1;
      if (embedCalls === 2) throw new EmbeddingQuotaExceededError("Gemini daily embedding quota exceeded");
      return texts.map((_, i) => vector(i));
    });

    const input: ApplyInput = {
      ...EMPTY_INPUT,
      skills,
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

    expect(result.tables.find((t) => t.table === "courses")).toMatchObject({ upserted: 1 });
    expect(result.embeddings).toEqual([
      { table: "skills", total: skillCount, done: EMBED_BATCH_SIZE, remaining: 5, stoppedByQuota: true },
      { table: "occupations", total: 0, done: 0, remaining: 0, stoppedByQuota: true },
    ]);
    // The first batch's vectors are already durable, each written as its own per-row update.
    const skillEmbeddingUpdates = updates.filter((u) => u.table === "skills");
    expect(skillEmbeddingUpdates).toHaveLength(EMBED_BATCH_SIZE);
  });
});
