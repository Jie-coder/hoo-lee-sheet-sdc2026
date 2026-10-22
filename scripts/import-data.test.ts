import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMBEDDING_DIMENSIONS } from "../src/types/contracts";
import { pathToFileURL } from "node:url";
import { EXIT_CODE_EMBEDDINGS_INCOMPLETE, isDirectRun, runCli, runImport } from "./import-data";
import type { Embedder } from "./lib/clients";
import { EmbeddingQuotaExceededError } from "./lib/embedding-quota";

describe("isDirectRun", () => {
  const scriptPath = join(process.cwd(), "scripts", "import-data.ts");

  it("matches when the module URL is the script path as a file URL", () => {
    expect(isDirectRun(pathToFileURL(scriptPath).href, scriptPath)).toBe(true);
  });

  it("does not match a Windows-style path glued onto file:// (the old bug)", () => {
    const windowsPath = "C:\\dev\\laluan\\scripts\\import-data.ts";
    expect(isDirectRun("file:///C:/dev/laluan/scripts/import-data.ts", windowsPath)).toBe(
      process.platform === "win32"
    );
    expect(`file://${windowsPath}`).not.toBe("file:///C:/dev/laluan/scripts/import-data.ts");
  });

  it("does not match when imported by another file, or with no script path", () => {
    expect(isDirectRun(pathToFileURL(scriptPath).href, join(process.cwd(), "node_modules", "vitest", "x.js"))).toBe(false);
    expect(isDirectRun(pathToFileURL(scriptPath).href, undefined)).toBe(false);
  });
});

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
      // 2 from courses/keywords + 1 ESCO skill only occupation_skills.csv mentions.
      skills: 3,
      occupations: 2,
      sources: 5,
      exposure: 2,
      cluster_demand: 2,
      scenarios: 3,
      courses: 3,
      programs: 3,
      signals: 4,
      occupation_skills: 2,
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

describe("runImport: occupation_skills.csv", () => {
  it("reports bad relation, non-skill URI, duplicate pair and unknown occupation in the invalid fixture", async () => {
    const result = await runImport({ dir: INVALID_DIR, apply: false, env: {} });
    const file = result.report.files.find((f) => f.file === "occupation_skills.csv");
    expect(file).toMatchObject({ totalRows: 4, invalidRows: 3 });

    const byColumn = (column: string) => file?.issues.filter((issue) => issue.column === column) ?? [];
    expect(byColumn("relation")).toHaveLength(1);
    expect(byColumn("skill_uri")).toHaveLength(1);
    expect(byColumn("occupation_id + skill_uri")).toEqual([expect.objectContaining({ row: 5 })]);

    // The invalid occupations.csv fixture has o010/o011 only, so o001 is unknown.
    const unknownOccupation = result.report.crossFileIssues.filter(
      (issue) => issue.file === "occupation_skills.csv" && issue.column === "occupation_id"
    );
    expect(unknownOccupation.length).toBeGreaterThan(0);
    expect(result.exitCode).toBe(1);
  });

  it("reports demand.csv and scenarios.csv errors at their row and column", async () => {
    const result = await runImport({ dir: INVALID_DIR, only: "demand,scenarios", apply: false, env: {} });
    const issuesIn = (name: string) => result.report.files.find((f) => f.file === name)?.issues ?? [];
    expect(issuesIn("demand.csv").map((issue) => [issue.row, issue.column])).toEqual([
      [3, "cluster"],
      [4, "value"],
      [5, "prev_period"],
      [6, "cluster + isco_major_group + metric + period"],
    ]);
    expect(issuesIn("scenarios.csv").map((issue) => [issue.row, issue.column])).toEqual([
      [4, "scenario_id"],
      [5, "demand_multiplier"],
      [6, "page_or_figure"],
      [3, "theta"],
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("flags a demand.csv / scenarios.csv source_name missing from sources.csv as an error", async () => {
    const result = await runImport({ dir: INVALID_DIR, only: "demand,scenarios,sources", apply: false, env: {} });
    const unknown = result.report.crossFileIssues.filter((issue) => issue.column === "source_name");
    expect(unknown.map((issue) => [issue.file, issue.severity])).toEqual([
      ["demand.csv", "error"],
      ["scenarios.csv", "error"],
    ]);
  });

  it("is reachable with --only occupation-skills", async () => {
    const result = await runImport({ dir: VALID_DIR, only: "occupation-skills", apply: false, env: {} });
    expect(result.report.files.map((f) => f.file)).toEqual(["occupation_skills.csv"]);
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
    const updates: { table: string; set: Record<string, unknown>; value: unknown }[] = [];
    const createSupabaseClient = vi.fn(
      () =>
        ({
          from(table: string) {
            return {
              upsert(rows: Record<string, unknown>[]) {
                upserts.push({ table, rows });
                return Promise.resolve({ error: null });
              },
              update(set: Record<string, unknown>) {
                return {
                  eq(_column: string, value: unknown) {
                    updates.push({ table, set, value });
                    return Promise.resolve({ error: null });
                  },
                };
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

    // occupations/skills are upserted once, before any embedding call (so
    // the catalogue is durable even if Gemini never answers), then each
    // row's embedding is written separately with a per-row update once
    // computed.
    const occupationsUpserts = upserts.filter((u) => u.table === "occupations");
    expect(occupationsUpserts).toHaveLength(1);
    const occupationsEmbeddingUpdates = updates.filter((u) => u.table === "occupations");
    expect(occupationsEmbeddingUpdates.length).toBeGreaterThan(0);
    expect(
      occupationsEmbeddingUpdates.every((u) => (u.set.embedding as number[]).length === EMBEDDING_DIMENSIONS)
    ).toBe(true);

    const signalsUpsert = upserts.find((u) => u.table === "signals");
    expect(signalsUpsert?.rows.length).toBeGreaterThan(0);
    expect(signalsUpsert?.rows.every((row) => !("id" in row))).toBe(true);

    expect(result.applyResult?.skipped).toEqual([]);
    expect(result.applyResult?.embeddings).toEqual([
      { table: "skills", total: 3, done: 3, remaining: 0, stoppedByQuota: false },
      { table: "occupations", total: 2, done: 2, remaining: 0, stoppedByQuota: false },
    ]);
  });

  it("writes every table but exits 3 with an INCOMPLETE message when Gemini's quota stops embeddings partway", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    try {
      writeFileSync(
        join(cwd, ".env.local"),
        "SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=service-role-key\nGEMINI_API_KEY=gemini-key\n"
      );
      const createSupabaseClient = vi.fn(
        () =>
          ({
            from() {
              return {
                upsert() {
                  return Promise.resolve({ error: null });
                },
                select() {
                  return { in() { return Promise.resolve({ data: [] }); } };
                },
              };
            },
          }) as unknown as SupabaseClient
      );
      const createEmbedder = vi.fn(
        () =>
          (async () => {
            throw new EmbeddingQuotaExceededError("Gemini daily embedding quota exceeded: limit 100");
          }) as Embedder
      );

      const result = await runCli(["--apply", "--dir", join(process.cwd(), VALID_DIR)], cwd, {
        createSupabaseClient,
        createEmbedder,
      });

      expect(result.exitCode).toBe(EXIT_CODE_EMBEDDINGS_INCOMPLETE);
      const output = result.stdout.join("\n");
      expect(output).toContain("INCOMPLETE");
      expect(output).toMatch(/skills: embedded 0\/3/);
      expect(output).toMatch(/occupations: embedded 0\/2/);
      expect(output).toContain("Rerun the same command to resume");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("exits 1 naming the table/row id and error when an existing skill's update fails, and never writes any later table", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "laluan-cli-"));
    try {
      writeFileSync(
        join(cwd, ".env.local"),
        "SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=service-role-key\nGEMINI_API_KEY=gemini-key\n"
      );
      const EXISTING_SKILL_ID = "00000000-0000-0000-0000-000000000001";
      const upsertCalls: string[] = [];
      const createSupabaseClient = vi.fn(
        () =>
          ({
            from(table: string) {
              return {
                upsert() {
                  upsertCalls.push(table);
                  return Promise.resolve({ error: null });
                },
                update() {
                  return {
                    eq(_column: string, value: unknown) {
                      if (table === "skills" && value === EXISTING_SKILL_ID) {
                        return Promise.resolve({ error: { message: "connection reset" } });
                      }
                      return Promise.resolve({ error: null });
                    },
                  };
                },
                select() {
                  return {
                    in() {
                      return Promise.resolve({
                        data:
                          table === "skills"
                            ? [{ id: EXISTING_SKILL_ID, label_en: "Data analysis", embedding: null }]
                            : [],
                      });
                    },
                  };
                },
              };
            },
          }) as unknown as SupabaseClient
      );
      const createEmbedder = vi.fn(() => (vi.fn(async () => []) as unknown) as Embedder);

      const result = await runCli(["--apply", "--dir", join(process.cwd(), VALID_DIR)], cwd, {
        createSupabaseClient,
        createEmbedder,
      });

      expect(result.exitCode).toBe(1);
      const output = result.stdout.join("\n");
      expect(output).toContain("skills");
      expect(output).toContain(EXISTING_SKILL_ID);
      expect(output).toContain("connection reset");
      // Stopped before the new skill (a different id) was ever upserted, and before any later table.
      expect(upsertCalls).not.toContain("skills");
      expect(upsertCalls).not.toContain("occupations");
      expect(upsertCalls).not.toContain("courses");
      expect(createEmbedder).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
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
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
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
      "would write: skills 3, occupations 2, sources 5, exposure 2, cluster_demand 2, scenarios 3, courses 3, programs 3, signals 4, occupation_skills 2"
    );
  });
});
