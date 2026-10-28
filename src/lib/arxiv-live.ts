// Live arXiv counts for the catalogue's keywords, at request time. Same
// queries and windows as scripts/fetch-arxiv.ts, with arXiv's API etiquette
// (one request every ~3 s, a User-Agent, no parallel calls), a per-request
// timeout and an overall time budget so a refresh fits one serverless call.
// Keywords that don't fit the budget keep their previous counts and are
// refreshed first next time (stalest first).
import "server-only";
import { arxivCountUrl, arxivWindows, parseTotalResults } from "../../scripts/lib/arxiv";
import type { CatalogueKeyword } from "@/lib/catalogue";
import { arxivQueryFromUrl, TREND_SOURCE_NAME, withCounts, type TrendSnapshot } from "@/lib/live-signals";
import type { IsoDate } from "@/types/contracts";

export const ARXIV_DELAY_MS = 3100;
export const ARXIV_TIMEOUT_MS = 10_000;
export const DEFAULT_BUDGET_MS = 45_000;
const USER_AGENT = "Laluan/0.1 (SDC Hackathon 2026; https://github.com/Jie-coder/hoo-lee-sheet-sdc2026)";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type RefreshOptions = {
  /** Only these keywords (default: stalest first, as many as the budget allows). */
  keywords?: string[];
  budgetMs?: number;
  delayMs?: number;
  timeoutMs?: number;
  now?: () => Date;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
};

/** Tests only: defaults merged into every refresh (fake fetch, no delays). */
export const arxivTestHooks: { options: RefreshOptions } = { options: {} };

export type RefreshOutcome = {
  snapshot: TrendSnapshot;
  refreshed: string[];
  skipped: string[];
  failed: { keyword: string; error: string }[];
};

async function countOnce(fetchImpl: FetchLike, url: string, timeoutMs: number): Promise<number> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const total = parseTotalResults(await response.text());
  if (total === null) throw new Error("no totalResults in the arXiv response");
  return total;
}

/** Fetch fresh counts on top of `base` (the last good snapshot). Never throws for a single keyword. */
export async function refreshFromArxiv(base: TrendSnapshot, options: RefreshOptions = {}): Promise<RefreshOutcome> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => new Date());
  const delayMs = options.delayMs ?? ARXIV_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? ARXIV_TIMEOUT_MS;
  const budgetMs = options.budgetMs ?? (Number(process.env.ARXIV_REFRESH_BUDGET_MS) || DEFAULT_BUDGET_MS);
  const started = now().getTime();
  const asOf = now().toISOString().slice(0, 10) as IsoDate;
  const windows = arxivWindows(asOf);

  const wanted = options.keywords ? new Set(options.keywords) : null;
  // Stalest first: oldest recent-window end, then the original order.
  const order = base.keywords
    .map((keyword, index) => ({ keyword, index }))
    .filter(({ keyword }) => !wanted || wanted.has(keyword.keyword))
    .sort((a, b) => a.keyword.recentWindow.end.localeCompare(b.keyword.recentWindow.end) || a.index - b.index);

  const updated = new Map<string, CatalogueKeyword>();
  const refreshed: string[] = [];
  const failed: RefreshOutcome["failed"] = [];
  const skipped: string[] = [];
  let calls = 0;
  // Time one keyword needs: two calls, each with its gap and worst-case timeout margin.
  const perKeyword = 2 * delayMs;

  for (const { keyword } of order) {
    if (now().getTime() - started + perKeyword > budgetMs) {
      skipped.push(keyword.keyword);
      continue;
    }
    const query = arxivQueryFromUrl(keyword.url);
    if (!query) {
      failed.push({ keyword: keyword.keyword, error: "no arXiv query in the keyword URL" });
      continue;
    }
    try {
      if (calls > 0) await sleep(delayMs);
      calls += 1;
      const recent = await countOnce(fetchImpl, arxivCountUrl(query, windows.recent), timeoutMs);
      await sleep(delayMs);
      calls += 1;
      const previous = await countOnce(fetchImpl, arxivCountUrl(query, windows.previous), timeoutMs);
      updated.set(keyword.keyword, withCounts(keyword, recent, previous, asOf));
      refreshed.push(keyword.keyword);
    } catch (error) {
      failed.push({ keyword: keyword.keyword, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const keywords = base.keywords.map((keyword) => updated.get(keyword.keyword) ?? keyword);
  const snapshot: TrendSnapshot = {
    source: TREND_SOURCE_NAME,
    fetchedAt: now().toISOString(),
    asOf: refreshed.length ? asOf : base.asOf,
    keywords,
    refreshed,
  };
  return { snapshot, refreshed, skipped, failed };
}
