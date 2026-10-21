import { describe, expect, it } from "vitest";
import {
  arxivCountUrl,
  arxivWindows,
  hasEnoughPapers,
  parseTotalResults,
  signalDirection,
  submittedDateFilter,
} from "./arxiv";
import { mapKeywordRow } from "./mappers";

describe("arxivWindows", () => {
  it("gives two back-to-back 90-day windows ending on the as-of date", () => {
    expect(arxivWindows("2026-10-19")).toEqual({
      recent: { start: "2026-07-22", end: "2026-10-19" },
      previous: { start: "2026-04-23", end: "2026-07-21" },
    });
  });
});

describe("arxivCountUrl", () => {
  it("wraps the keyword query and adds a whole-day submittedDate filter", () => {
    const window = { start: "2026-07-22", end: "2026-10-19" };
    expect(submittedDateFilter(window)).toBe("submittedDate:[202607220000 TO 202610192359]");
    const url = new URL(arxivCountUrl('"AI agent"', window));
    expect(url.searchParams.get("search_query")).toBe(
      'all:("AI agent") AND submittedDate:[202607220000 TO 202610192359]',
    );
  });
});

describe("parseTotalResults", () => {
  it("reads the total, and returns null for a response without one", () => {
    expect(parseTotalResults("<feed><opensearch:totalResults>719</opensearch:totalResults></feed>")).toBe(719);
    expect(parseTotalResults("<html>Rate limited</html>")).toBeNull();
  });
});

describe("signalDirection", () => {
  it("is flat within ±10%, so 45 vs 46 is no longer 'down'", () => {
    expect(signalDirection(45, 46)).toBe("flat");
    expect(signalDirection(110, 100)).toBe("flat");
    expect(signalDirection(111, 100)).toBe("up");
    expect(signalDirection(89, 100)).toBe("down");
    expect(signalDirection(3, 0)).toBe("up");
  });
});

describe("hasEnoughPapers", () => {
  it("needs 20 papers in at least one window", () => {
    expect(hasEnoughPapers(1, 3)).toBe(false);
    expect(hasEnoughPapers(5, 30)).toBe(true);
  });
});

describe("keywords.csv checks", () => {
  const row = {
    keyword: "AI agents",
    arxiv_query: '"AI agent"',
    skills: "principles of artificial intelligence",
    skill_uris: "http://data.europa.eu/esco/skill/e465a154-93f7-4973-9ce1-31659fe16dd2",
    direction: "up",
    count_last_90d: "45",
    count_prev_90d: "46",
    checked_on: "2026-10-19",
    notes: "",
  };

  it("warns when direction disagrees with the counts", () => {
    const { warnings, value } = mapKeywordRow(row, 2);
    expect(value?.direction).toBe("up");
    expect(warnings).toEqual([expect.objectContaining({ column: "direction", severity: "warning" })]);
  });

  it("accepts flat, and warns only when both windows are below 20 papers", () => {
    expect(mapKeywordRow({ ...row, direction: "flat" }, 2).warnings).toEqual([]);
    const small = mapKeywordRow({ ...row, direction: "down", count_last_90d: "1", count_prev_90d: "3" }, 3);
    expect(small.warnings).toEqual([expect.objectContaining({ column: "count_last_90d" })]);
  });
});
