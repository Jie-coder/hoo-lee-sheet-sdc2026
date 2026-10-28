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
import { arxivTestHooks } from "@/lib/arxiv-live";
import { resetLocalSnapshot } from "@/lib/signal-store";
import { SignalSnapshotSchema } from "@/types/contracts";
import { GET } from "../signals/route";
import { POST } from "./route";

const atom = (total: number) =>
  new Response(`<feed><opensearch:totalResults>${total}</opensearch:totalResults></feed>`, { status: 200 });
const post = (body?: unknown) =>
  new Request("http://localhost/api/refresh-signals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("/api/refresh-signals and /api/signals", () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, file: process.env.TREND_SNAPSHOT_FILE };
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.TREND_SNAPSHOT_FILE = join(mkdtempSync(join(tmpdir(), "laluan-trend-")), "snapshot.json");
    resetLocalSnapshot();
  });
  afterEach(() => {
    arxivTestHooks.options = {};
    for (const [name, value] of [["SUPABASE_URL", saved.url], ["SUPABASE_SERVICE_ROLE_KEY", saved.key], ["TREND_SNAPSHOT_FILE", saved.file]] as const) {
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
});
