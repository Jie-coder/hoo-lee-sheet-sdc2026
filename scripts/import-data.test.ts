import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS } from "../src/types/contracts";
import { runImport } from "./import-data";
import type { Embedder } from "./lib/clients";

const VALID_DIR = "scripts/fixtures/valid";
const INVALID_DIR = "scripts/fixtures/invalid";

const FULL_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GEMINI_API_KEY: "gemini-key",
};

function spyFactories() {
  const createSupabaseClient = vi.fn(() => ({ from: vi.fn() }) as unknown as SupabaseClient);
  const createEmbedder = vi.fn(
    () => (vi.fn(async () => []) as unknown) as Embedder
  );
  return { createSupabaseClient, createEmbedder };
}

describe("runImport (dry run)", () => {
  it("exits 0 on the valid fixtures and never creates a Supabase or Gemini client", async () => {
    const { createSupabaseClient, createEmbedder } = spyFactories();
    const result = await runImport({
      dir: VALID_DIR,
      apply: false,
      env: {},
      createSupabaseClient,
      createEmbedder,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.files.every((f) => f.invalidRows === 0)).toBe(true);
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createEmbedder).not.toHaveBeenCalled();
    expect(result.applyResult).toBeUndefined();
  });

  it("exits non-zero on the invalid fixtures and still never touches the clients", async () => {
    const { createSupabaseClient, createEmbedder } = spyFactories();
    const result = await runImport({
      dir: INVALID_DIR,
      apply: false,
      env: {},
      createSupabaseClient,
      createEmbedder,
    });

    expect(result.exitCode).toBe(1);
    const totalErrors =
      result.report.files.flatMap((f) => f.issues).filter((i) => i.severity === "error").length +
      result.report.crossFileIssues.filter((i) => i.severity === "error").length;
    expect(totalErrors).toBeGreaterThan(0);
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createEmbedder).not.toHaveBeenCalled();
  });

  it("reports a clear argument error for an unknown --only name, before reading any file", async () => {
    const result = await runImport({ dir: VALID_DIR, only: "bogus", apply: false, env: {} });
    expect(result.exitCode).toBe(1);
    expect(result.argError).toContain("bogus");
  });

  it("restricts to the requested file with --only, accepting the programs/programmes alias", async () => {
    const result = await runImport({ dir: VALID_DIR, only: "programs", apply: false, env: {} });
    expect(result.report.files).toHaveLength(1);
    expect(result.report.files[0].file).toBe("programmes.csv");
  });

  it("reports a missing file as a note, not an error, and still exits 0", async () => {
    const result = await runImport({ dir: "data", apply: false, env: {} });
    expect(result.exitCode).toBe(0);
    expect(result.report.files.every((f) => !f.present)).toBe(true);
  });
});

describe("runImport (--apply)", () => {
  it("refuses to apply when validation has errors, without creating any client", async () => {
    const { createSupabaseClient, createEmbedder } = spyFactories();
    const result = await runImport({
      dir: INVALID_DIR,
      apply: true,
      env: FULL_ENV,
      createSupabaseClient,
      createEmbedder,
    });

    expect(result.applyError).toContain("fix the validation errors");
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createEmbedder).not.toHaveBeenCalled();
  });

  it("fails with the missing variable names only, and leaks no secret value", async () => {
    const { createSupabaseClient, createEmbedder } = spyFactories();
    const result = await runImport({
      dir: VALID_DIR,
      apply: true,
      env: { SUPABASE_SERVICE_ROLE_KEY: "super-secret-value" },
      createSupabaseClient,
      createEmbedder,
    });

    expect(result.applyError).toContain("SUPABASE_URL");
    expect(result.applyError).toContain("GEMINI_API_KEY");
    expect(result.applyError).not.toContain("super-secret-value");
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(createEmbedder).not.toHaveBeenCalled();
  });

  it("upserts valid rows and embeds in a 768-dim batch when the env and clients are present", async () => {
    const upserts: { table: string; rows: Record<string, unknown>[] }[] = [];
    const createSupabaseClient = vi.fn(
      () =>
        ({
          from(table: string) {
            return {
              upsert(rows: Record<string, unknown>[]) {
                upserts.push({ table, rows });
                return Promise.resolve({ error: null });
              },
              select() {
                return { in() { return Promise.resolve({ data: [] }); } };
              },
            };
          },
        }) as unknown as SupabaseClient
    );

    const embedCalls: string[][] = [];
    const createEmbedder = vi.fn(
      () =>
        (async (texts: string[]) => {
          embedCalls.push(texts);
          return texts.map((_, i) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => i));
        }) as Embedder
    );

    const result = await runImport({
      dir: VALID_DIR,
      apply: true,
      env: FULL_ENV,
      createSupabaseClient,
      createEmbedder,
    });

    expect(result.applyError).toBeUndefined();
    expect(createSupabaseClient).toHaveBeenCalledTimes(1);
    expect(createEmbedder).toHaveBeenCalledTimes(1);

    const coursesUpsert = upserts.find((u) => u.table === "courses");
    expect(coursesUpsert?.rows.length).toBe(3);

    const occupationsUpsert = upserts.find((u) => u.table === "occupations");
    expect(occupationsUpsert?.rows.every((row) => (row.embedding as number[]).length === EMBEDDING_DIMENSIONS)).toBe(
      true
    );

    expect(result.applyResult?.skipped.map((s) => s.file)).toEqual([
      "sources.csv",
      "keywords.csv",
      "exposure.csv",
    ]);
  });
});
