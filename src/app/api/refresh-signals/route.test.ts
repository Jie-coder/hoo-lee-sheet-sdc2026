// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// connection() needs a Next request scope; the handlers are plain functions here.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
// Spy on saveSnapshot while keeping the real store behaviour.
vi.mock("@/lib/signal-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/signal-store")>();
  return { ...actual, saveSnapshot: vi.fn(actual.saveSnapshot) };
});
import { existsSync } from "node:fs";
import { arxivTestHooks } from "@/lib/arxiv-live";
import { resetLocalSnapshot, saveSnapshot } from "@/lib/signal-store";
import { SignalSnapshotSchema } from "@/types/contracts";
import { GET } from "../signals/route";
import { POST } from "./route";

const atom = (total: number) =>
  new Response(`<feed><opensearch:totalResults>${total}</opensearch:totalResults></feed>`, { status: 200 });
const post = (body?: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/refresh-signals", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("/api/refresh-signals and /api/signals", () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, file: process.env.TREND_SNAPSHOT_FILE, locked: process.env.TREND_REFRESH_LOCKED, refreshKey: process.env.TREND_REFRESH_KEY };
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.TREND_REFRESH_LOCKED;
    delete process.env.TREND_REFRESH_KEY;
    vi.mocked(saveSnapshot).mockClear();
    process.env.TREND_SNAPSHOT_FILE = join(mkdtempSync(join(tmpdir(), "laluan-trend-")), "snapshot.json");
    resetLocalSnapshot();
  });
  afterEach(() => {
    arxivTestHooks.options = {};
    for (const [name, value] of [["SUPABASE_URL", saved.url], ["SUPABASE_SERVICE_ROLE_KEY", saved.key], ["TREND_SNAPSHOT_FILE", saved.file], ["TREND_REFRESH_LOCKED", saved.locked], ["TREND_REFRESH_KEY", saved.refreshKey]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    resetLocalSnapshot();
  });

  it("latest serves the bundled snapshot before any refresh", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("bundled");
    expect(SignalSnapshotSchema.safeParse(body.snapshot).success).toBe(true);
    expect(body.trend.source).toBe("arXiv API");
  });

  it("refresh stores a live snapshot that latest then serves", async () => {
    arxivTestHooks.options = { sleep: async () => {}, fetchImpl: async () => atom(77), now: () => new Date("2026-01-05T03:00:00.000Z") };
    const response = await POST(post({ keywords: ["document understanding"] }) as never);
    const body = await response.json();
    if (response.status !== 200) throw new Error(JSON.stringify(body));
    expect(body.refreshed.length).toBeGreaterThan(0);
    expect(body.active.source).toBe("live");
    expect(body.active.store).toBe("local");
    const latest = await (await GET()).json();
    expect(latest.source).toBe("live");
    expect(latest.fetchedAt).toBe("2026-01-05T03:00:00.000Z");
  });

  it("falls back to the last good snapshot when arXiv is down", async () => {
    arxivTestHooks.options = { sleep: async () => {}, fetchImpl: async () => atom(10), now: () => new Date("2026-01-05T03:00:00.000Z") };
    await POST(post() as never);
    arxivTestHooks.options = { sleep: async () => {}, fetchImpl: async () => new Response("down", { status: 503 }) };
    const response = await POST(post() as never);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.active.source).toBe("last-good");
    expect(body.active.fetchedAt).toBe("2026-01-05T03:00:00.000Z");
  });

  it("rejects a malformed body", async () => {
    const response = await POST(post({ keywords: "nope" }) as never);
    expect(response.status).toBe(400);
  });

  it("default refresh stops at its budget; ?full=1 re-counts every keyword", async () => {
    let clock = 0;
    const timed = {
      fetchImpl: async () => atom(40),
      now: () => new Date(Date.UTC(2026, 0, 5) + clock),
      sleep: async (ms: number) => {
        clock += ms;
      },
    };
    arxivTestHooks.options = timed;
    const partial = await (await POST(post() as never)).json();
    expect(partial.refreshed).toHaveLength(3);
    expect(partial.skipped.length).toBeGreaterThan(0);
    clock = 0;
    const full = await (await POST(new Request("http://localhost/api/refresh-signals?full=1", { method: "POST" }) as never)).json();
    expect(full.skipped).toEqual([]);
    expect(full.refreshed.length + full.failed.length).toBe(full.active.trend.keywords.length);
  });

  describe("finals freeze (TREND_REFRESH_LOCKED)", () => {
    const counting = () => {
      const calls = { n: 0 };
      arxivTestHooks.options = {
        sleep: async () => {},
        fetchImpl: async () => {
          calls.n += 1;
          return atom(99);
        },
        now: () => new Date("2026-01-05T03:00:00.000Z"),
      };
      return calls;
    };

    for (const value of ["1", "true"]) {
      it(`TREND_REFRESH_LOCKED=${value}: 423, saved snapshot returned, nothing stored, arXiv not called`, async () => {
        process.env.TREND_REFRESH_LOCKED = value;
        const calls = counting();
        const response = await POST(post({ keywords: ["document understanding"] }) as never);
        expect(response.status).toBe(423);
        const body = await response.json();
        expect(body.error).toBe("Trend data is frozen for the finals; showing the saved snapshot.");
        expect(body.active.source).toBe("bundled");
        expect(body.active.trend.asOf).toBe("2026-10-29");
        expect(calls.n).toBe(0);
        expect(saveSnapshot).not.toHaveBeenCalled();
        expect(existsSync(process.env.TREND_SNAPSHOT_FILE!)).toBe(false);
        expect((await (await GET()).json()).source).toBe("bundled");
      });
    }

    it("unset or other values leave refresh as before", async () => {
      process.env.TREND_REFRESH_LOCKED = "0";
      const calls = counting();
      const response = await POST(post({ keywords: ["document understanding"] }) as never);
      expect(response.status).toBe(200);
      expect(calls.n).toBeGreaterThan(0);
      expect(saveSnapshot).toHaveBeenCalledTimes(1);
    });

    it("x-refresh-key bypasses the lock only with the right key, and only when TREND_REFRESH_KEY is set", async () => {
      process.env.TREND_REFRESH_LOCKED = "1";
      const calls = counting();
      // No TREND_REFRESH_KEY configured: any header (even empty) stays locked.
      expect((await POST(post(undefined, { "x-refresh-key": "" }) as never)).status).toBe(423);
      expect((await POST(post(undefined, { "x-refresh-key": "anything" }) as never)).status).toBe(423);
      process.env.TREND_REFRESH_KEY = "test-key-123";
      expect((await POST(post({ keywords: ["AI agents"] }) as never)).status).toBe(423);
      expect((await POST(post({ keywords: ["AI agents"] }, { "x-refresh-key": "test-key-12" }) as never)).status).toBe(423);
      expect((await POST(post({ keywords: ["AI agents"] }, { "x-refresh-key": "wrong" }) as never)).status).toBe(423);
      expect(calls.n).toBe(0);
      expect(saveSnapshot).not.toHaveBeenCalled();
      const ok = await POST(post({ keywords: ["AI agents"] }, { "x-refresh-key": "test-key-123" }) as never);
      expect(ok.status).toBe(200);
      expect((await ok.json()).active.source).toBe("live");
      expect(calls.n).toBeGreaterThan(0);
      expect(saveSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back to the bundled snapshot when the Supabase read fails", async () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:9";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "not-a-real-key";
    const body = await (await GET()).json();
    expect(body.source).toBe("bundled");
    expect(body.warning).toMatch(/Supabase unavailable/);
    expect(body.trend.asOf).toBe("2026-10-29");
  }, 15_000);
});
