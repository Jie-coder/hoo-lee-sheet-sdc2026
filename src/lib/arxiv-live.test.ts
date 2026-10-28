import { describe, expect, it } from "vitest";
import { refreshFromArxiv } from "@/lib/arxiv-live";
import { CATALOGUE } from "@/lib/catalogue";
import { bundledSnapshot } from "@/lib/live-signals";

const atom = (total: number) =>
  new Response(`<feed><opensearch:totalResults>${total}</opensearch:totalResults></feed>`, { status: 200 });

describe("refreshFromArxiv", () => {
  const base = bundledSnapshot(CATALOGUE);
  const now = () => new Date("2026-10-29T02:00:00.000Z");

  it("re-counts the asked keywords and stamps the fetch time", async () => {
    const urls: string[] = [];
    const keyword = base.keywords[0].keyword;
    const outcome = await refreshFromArxiv(base, {
      keywords: [keyword],
      now,
      sleep: async () => {},
      fetchImpl: async (url) => {
        urls.push(url);
        return atom(urls.length === 1 ? 300 : 100);
      },
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("export.arxiv.org/api/query");
    expect(outcome.refreshed).toEqual([keyword]);
    expect(outcome.snapshot.fetchedAt).toBe("2026-10-29T02:00:00.000Z");
    const updated = outcome.snapshot.keywords.find((entry) => entry.keyword === keyword)!;
    expect([updated.recent, updated.previous].sort()).toEqual([100, 300]);
  });

  it("reports failures and keeps the old counts when arXiv errors", async () => {
    const keyword = base.keywords[0].keyword;
    const outcome = await refreshFromArxiv(base, {
      keywords: [keyword],
      now,
      sleep: async () => {},
      fetchImpl: async () => new Response("down", { status: 503 }),
    });
    expect(outcome.refreshed).toEqual([]);
    expect(outcome.failed[0]?.keyword).toBe(keyword);
    expect(outcome.snapshot.keywords[0].recent).toBe(base.keywords[0].recent);
  });

  it("stops at the time budget and skips the rest", async () => {
    let clock = 0;
    const outcome = await refreshFromArxiv(base, {
      budgetMs: 1000,
      delayMs: 300,
      now: () => new Date(Date.UTC(2026, 9, 29) + clock),
      sleep: async (ms) => {
        clock += ms;
      },
      fetchImpl: async () => atom(50),
    });
    expect(outcome.refreshed.length).toBeGreaterThan(0);
    expect(outcome.skipped.length).toBeGreaterThan(0);
    expect(outcome.refreshed.length + outcome.skipped.length + outcome.failed.length).toBe(base.keywords.length);
  });
});
