import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS } from "../src/types/contracts";
import { runCli, runImport } from "./import-data";
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

  it("computes per-table would-write counts from the same builders --apply uses", async () => {
    const result = await runImport({ dir: VALID_DIR, apply: false, env: {} });
    expect(result.wouldWrite).toEqual({
      skills: 2,
      occupations: 2,
      sources: 2,
      exposure: 2,
      courses: 3,
      programs: 3,
      signals: 4,
      occupation_skills: 0,
    });
  });

  it("reports a missing file as a note, not an error, and still exits 0", async () => {
    // An empty temp dir, not the real data/ folder: data/ fills up as the team commits CSVs.
    const emptyDir = mkdtempSync(join(tmpdir(), "laluan-empty-data-"));
    try {
      const result = await runImport({ dir: emptyDir, apply: false, env: {} });
      expect(result.exitCode).toBe(0);
      expect(result.report.files.every((f) => !f.present)).toBe(true);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
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

    const signalsUpsert = upserts.find((u) => u.table === "signals");
    expect(signalsUpsert?.rows.length).toBeGreaterThan(0);
    expect(signalsUpsert?.rows.every((row) => !("id" in row))).toBe(true);

    expect(result.applyResult?.skipped).toEqual([]);
  });
});

describe("runCli --apply env resolution", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("exits 1 with a clear message when .env.local does not exist, without touching process.env", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    dirs.push(cwd);

    const previous = { ...process.env };
    process.env.SUPABASE_URL = "https://ambient.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "ambient-secret";
    process.env.GEMINI_API_KEY = "ambient-gemini-secret";
    try {
      const result = await runCli(["--apply", "--dir", "scripts/fixtures/valid"], cwd);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.join("\n")).toContain(".env.local");
      expect(result.stderr.join("\n")).toContain("SUPABASE_URL");
      expect(result.stderr.join("\n")).not.toContain("ambient-secret");
      expect(result.stderr.join("\n")).not.toContain("ambient-gemini-secret");
    } finally {
      process.env = previous;
    }
  });

  it("lists only the missing variable names when .env.local exists but is incomplete, and never leaks a value", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    dirs.push(cwd);
    writeFileSync(join(cwd, ".env.local"), "SUPABASE_SERVICE_ROLE_KEY=super-secret-value\n");

    const result = await runCli(["--apply", "--dir", "scripts/fixtures/valid"], cwd);
    expect(result.exitCode).toBe(1);
    const output = result.stderr.join("\n");
    expect(output).toContain("SUPABASE_URL");
    expect(output).toContain("GEMINI_API_KEY");
    expect(output).not.toContain("super-secret-value");
  });

  it("ignores process.env even when .env.local exists and is complete, using only the file's values", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    dirs.push(cwd);
    writeFileSync(
      join(cwd, ".env.local"),
      "SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=file-secret\nGEMINI_API_KEY=file-gemini-secret\n"
    );

    const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "ambient-secret-should-be-ignored";
    const seenEnvs: unknown[] = [];
    const createSupabaseClient = vi.fn((env: unknown) => {
      seenEnvs.push(env);
      return {
        from: () => ({
          select: () => ({ in: () => Promise.resolve({ data: [] }) }),
          upsert: () => Promise.resolve({ error: null }),
        }),
      } as unknown as SupabaseClient;
    });
    const createEmbedder = vi.fn(() => (vi.fn(async () => []) as unknown) as Embedder);
    try {
      const result = await runCli(["--apply", "--dir", "scripts/fixtures/valid"], cwd, {
        createSupabaseClient,
        createEmbedder,
      });
      expect(result.stderr.join("\n")).not.toContain("missing required environment variable");
      expect(seenEnvs).toEqual([
        { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "file-secret", geminiApiKey: "file-gemini-secret" },
      ]);
      expect(result.stdout.join("\n") + result.stderr.join("\n")).not.toContain(
        "ambient-secret-should-be-ignored"
      );
    } finally {
      if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
    }
  });

  it("dry run never reaches env resolution or the clients module", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    dirs.push(cwd);
    const result = await runCli(["--dir", "scripts/fixtures/valid"], cwd);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toEqual([]);
  });

  it("dry run prints a would-write line with a count per target table", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    dirs.push(cwd);
    const result = await runCli(["--dir", "scripts/fixtures/valid"], cwd);
    const stdout = result.stdout.join("\n");
    expect(stdout).toContain(
      "would write: skills 2, occupations 2, sources 2, exposure 2, courses 3, programs 3, signals 4, occupation_skills 0"
    );
  });
});
