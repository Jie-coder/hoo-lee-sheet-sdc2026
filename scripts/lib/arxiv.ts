// Pure helpers for counting arXiv papers per keyword in two 90-day windows.
// scripts/fetch-arxiv.ts does the network calls.
// API docs: https://info.arxiv.org/help/api/user-manual.html
import type { SignalDirection } from "./row-schemas";

export const ARXIV_API = "https://export.arxiv.org/api/query";
export const WINDOW_DAYS = 90;

/** A change within ±10% between the two windows is "flat", not "up" or "down". */
export const FLAT_BAND = 0.1;

/** Below this many papers in both windows, a keyword is too small to read as a trend. */
export const MIN_PAPERS = 20;

export type DateWindow = { start: string; end: string };

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The two windows ending on `asOf` (inclusive): the last 90 days, and the 90
 * days before that. 2026-10-19 -> recent 2026-07-22..2026-10-19,
 * previous 2026-04-23..2026-07-21.
 */
export function arxivWindows(asOf: string): { recent: DateWindow; previous: DateWindow } {
  const recentStart = addDays(asOf, -(WINDOW_DAYS - 1));
  const previousEnd = addDays(recentStart, -1);
  return {
    recent: { start: recentStart, end: asOf },
    previous: { start: addDays(previousEnd, -(WINDOW_DAYS - 1)), end: previousEnd },
  };
}

/** arXiv's submittedDate filter for a window, whole days: [YYYYMMDD0000 TO YYYYMMDD2359]. */
export function submittedDateFilter(window: DateWindow): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  return `submittedDate:[${compact(window.start)}0000 TO ${compact(window.end)}2359]`;
}

/** URL that counts papers matching `arxivQuery` (keywords.csv's arxiv_query) inside `window`. */
export function arxivCountUrl(arxivQuery: string, window: DateWindow): string {
  const searchQuery = `all:(${arxivQuery}) AND ${submittedDateFilter(window)}`;
  const params = new URLSearchParams({ search_query: searchQuery, start: "0", max_results: "1" });
  return `${ARXIV_API}?${params.toString()}`;
}

/** The total from an arXiv Atom response, or null when the response has none (an error page). */
export function parseTotalResults(xml: string): number | null {
  const match = /<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/.exec(xml);
  return match ? Number(match[1]) : null;
}

/**
 * up / down when the recent window differs from the previous one by more than
 * FLAT_BAND (relative to the previous count), otherwise flat. 45 vs 46 is flat.
 */
export function signalDirection(recent: number, previous: number): SignalDirection {
  const base = Math.max(previous, 1);
  const change = (recent - previous) / base;
  if (change > FLAT_BAND) return "up";
  if (change < -FLAT_BAND) return "down";
  return "flat";
}

/** True when a keyword has enough papers to read as a trend (MIN_PAPERS in at least one window). */
export function hasEnoughPapers(recent: number, previous: number): boolean {
  return recent >= MIN_PAPERS || previous >= MIN_PAPERS;
}
