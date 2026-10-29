import { describe, expect, it } from "vitest";
import { refreshFromArxiv } from "@/lib/arxiv-live";
import { CATALOGUE } from "@/lib/catalogue";
import { fetchedParts } from "@/lib/format-fetched";
import { translate } from "@/lib/i18n-messages";
import { bundledSnapshot, carriedOverFrom, mytDate } from "@/lib/live-signals";

// 02:49 MYT on 29 Oct 2026 is still 28 Oct in UTC.
const defaultT = (key: Parameters<typeof translate>[1], vars?: Record<string, string>) => translate("en", key, vars);
const FETCH = new Date("2026-10-28T18:49:00.000Z");
const atom = (total: number) => new Response(`<opensearch:totalResults>${total}</opensearch:totalResults>`);

describe("trend dates are Malaysia (MYT) dates", () => {
  it("mytDate uses Asia/Kuala_Lumpur, not the UTC day", () => {
    expect(mytDate(FETCH)).toBe("2026-10-29");
    expect(mytDate(new Date("2026-10-29T15:59:00.000Z"))).toBe("2026-10-29");
    expect(mytDate(new Date("2026-10-29T16:00:00.000Z"))).toBe("2026-10-30");
  });

  it("a fetch at 02:49 MYT stores an ISO timestamp and is dated 29 Oct", async () => {
    const base = bundledSnapshot(CATALOGUE);
    const keyword = base.keywords[0];
    const outcome = await refreshFromArxiv(base, {
      keywords: [keyword.keyword],
      now: () => FETCH,
      sleep: async () => {},
      fetchImpl: async () => atom(100),
    });
    expect(outcome.snapshot.fetchedAt).toBe("2026-10-28T18:49:00.000Z");
    expect(outcome.snapshot.asOf).toBe("2026-10-29");
    expect(outcome.snapshot.keywords.find((k) => k.keyword === keyword.keyword)!.recentWindow.end).toBe("2026-10-29");
    const shown = fetchedParts(outcome.snapshot.fetchedAt, defaultT);
    expect(shown.date).toMatch(/^29 Oct/);
    expect(shown.time).toBe("02:49");
  });

  it("carriedOverFrom names the oldest date among keywords not re-counted", () => {
    const base = bundledSnapshot(CATALOGUE);
    expect(carriedOverFrom({ ...base, refreshed: [] })).toBe(base.keywords.map((k) => k.recentWindow.end).sort()[0]);
    expect(carriedOverFrom({ ...base, refreshed: base.keywords.map((k) => k.keyword) })).toBeNull();
  });
});
