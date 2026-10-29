// Live arXiv trend snapshots: pure helpers shared by the server (refresh
// route, /api/roles, /radar) and the browser (the "change the data" test
// panel). A snapshot is one dated set of keyword counts. Applying it to the
// bundled catalogue swaps the "today" signals, so every score and ranking
// built from that catalogue moves with the data.
import { arxivWindows, hasEnoughPapers, signalDirection } from "../../scripts/lib/arxiv";
import type { Catalogue, CatalogueKeyword, CatalogueSignal } from "@/lib/catalogue";
import { skillMomentum } from "@/lib/scoring";
import type { IsoDate, SignalReading, SignalSnapshot } from "@/types/contracts";

export const TREND_SOURCE_NAME = "arXiv API";

/** The app's display zone: every fetch and "signal checked" date is a Malaysia (MYT, UTC+8) date. */
export const TREND_TIME_ZONE = "Asia/Kuala_Lumpur";

/** The MYT calendar date of an instant, e.g. 2026-10-28T18:49Z -> 2026-10-29. */
export function mytDate(instant: Date): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TREND_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant) as IsoDate;
}

/** Oldest data date among keywords this snapshot did not re-count (null when all were re-counted). */
export function carriedOverFrom(trend: TrendSnapshot): IsoDate | null {
  const refreshed = new Set(trend.refreshed);
  const dates = trend.keywords.filter((keyword) => !refreshed.has(keyword.keyword)).map((keyword) => keyword.recentWindow.end).sort();
  return (dates[0] as IsoDate | undefined) ?? null;
}

/** Where the snapshot in use came from: a stored live fetch, or the counts bundled at build time. */
export type SnapshotOrigin = "live" | "bundled";

export type TrendSnapshot = {
  source: typeof TREND_SOURCE_NAME;
  /** ISO timestamp of the fetch (bundled: the catalogue's checked_on date at 00:00 UTC). */
  fetchedAt: string;
  /** End date of the recent 90-day window. */
  asOf: IsoDate;
  keywords: CatalogueKeyword[];
  /** Keywords whose counts came from this fetch; the rest were carried over from the previous snapshot. */
  refreshed: string[];
};

/** What the app is ranking with right now, plus why (shown on screen). */
export type ActiveSnapshot = {
  snapshot: TrendSnapshot;
  origin: SnapshotOrigin;
  /** Where a live snapshot is stored: "supabase" or "local" (server memory/disk). Null for bundled. */
  store: "supabase" | "local" | null;
  /** Set when a newer source was unavailable and we fell back. */
  warning: string | null;
};

export function bundledSnapshot(catalogue: Catalogue): TrendSnapshot {
  return {
    source: TREND_SOURCE_NAME,
    fetchedAt: `${catalogue.signalsAsOf}T00:00:00.000Z`,
    asOf: catalogue.signalsAsOf,
    keywords: catalogue.keywords.today,
    refreshed: [],
  };
}

/** The arXiv query behind a keyword, recovered from its checkable count URL. */
export function arxivQueryFromUrl(url: string): string | null {
  try {
    const search = new URL(url).searchParams.get("search_query") ?? "";
    const match = /^all:\((.*)\) AND submittedDate:/.exec(search);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Recompute one keyword's derived fields from new counts (windows end on `asOf`). */
export function withCounts(keyword: CatalogueKeyword, recent: number, previous: number, asOf?: IsoDate): CatalogueKeyword {
  const windows = asOf ? arxivWindows(asOf) : { recent: keyword.recentWindow, previous: keyword.previousWindow };
  let url = keyword.url;
  if (asOf) {
    const params = new URL(keyword.url);
    const query = arxivQueryFromUrl(keyword.url);
    if (query) {
      const compact = (iso: string) => iso.replace(/-/g, "");
      params.searchParams.set(
        "search_query",
        `all:(${query}) AND submittedDate:[${compact(windows.recent.start)}0000 TO ${compact(windows.recent.end)}2359]`,
      );
      url = params.toString();
    }
  }
  return {
    ...keyword,
    recent,
    previous,
    direction: signalDirection(recent, previous),
    momentum: skillMomentum(recent, previous),
    enough: hasEnoughPapers(recent, previous),
    recentWindow: windows.recent as CatalogueKeyword["recentWindow"],
    previousWindow: windows.previous as CatalogueKeyword["previousWindow"],
    url,
  };
}

/** Per-skill momentum: the mean of each usable mapped keyword's momentum (same rule as the catalogue build). */
export function signalsFromKeywords(keywords: readonly CatalogueKeyword[], asOf: IsoDate): Record<string, CatalogueSignal> {
  const perSkill = new Map<string, { momenta: number[]; keywords: string[] }>();
  for (const keyword of keywords) {
    if (!keyword.enough) continue;
    for (const id of keyword.skillIds) {
      const entry = perSkill.get(id) ?? { momenta: [], keywords: [] };
      entry.momenta.push(keyword.momentum);
      entry.keywords.push(keyword.keyword);
      perSkill.set(id, entry);
    }
  }
  return Object.fromEntries(
    [...perSkill].map(([id, entry]) => [
      id,
      {
        momentum: entry.momenta.reduce((sum, m) => sum + m, 0) / entry.momenta.length,
        keywords: entry.keywords,
        checkedOn: asOf,
      },
    ]),
  );
}

/** Counts implied by a target momentum m = ln((recent+1)/(previous+1)), keeping `previous` fixed. */
export function recentForMomentum(previous: number, momentum: number): number {
  return Math.max(0, Math.round((previous + 1) * Math.exp(momentum) - 1));
}

/** Shape check for a stored snapshot (it comes back from a database or disk). */
export function isTrendSnapshot(value: unknown): value is TrendSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<TrendSnapshot>;
  return (
    typeof v.fetchedAt === "string" &&
    typeof v.asOf === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.asOf) &&
    Array.isArray(v.keywords) &&
    v.keywords.length > 0 &&
    v.keywords.every(
      (k) => k && typeof k.keyword === "string" && Number.isFinite(k.recent) && Number.isFinite(k.previous) && Array.isArray(k.skillIds),
    )
  );
}

/**
 * The trend snapshot in the shared contract shape (src/types/contracts.ts):
 * one "momentum" reading per skill, value = mean momentum of its usable
 * keywords, window and URL from the first of those keywords.
 */
export function toSignalSnapshot(trend: TrendSnapshot): SignalSnapshot {
  const signals = signalsFromKeywords(trend.keywords, trend.asOf);
  const readings: SignalReading[] = Object.entries(signals).map(([skillId, signal]) => {
    const first = trend.keywords.find((keyword) => keyword.keyword === signal.keywords[0])!;
    return {
      skillId,
      source: "arXiv",
      metric: "momentum",
      value: signal.momentum,
      windowStart: first.recentWindow.start,
      windowEnd: first.recentWindow.end,
      url: first.url,
    };
  });
  return { asOf: trend.asOf, signals: readings };
}

/** A judge's test override: set one skill's momentum. Applied in the browser or per request only, never stored. */
export type MomentumOverride = { skillId: string; momentum: number };

export function applyMomentumOverrides(snapshot: SignalSnapshot, overrides: readonly MomentumOverride[]): SignalSnapshot {
  if (overrides.length === 0) return snapshot;
  const bySkill = new Map(overrides.map((override) => [override.skillId, override.momentum]));
  const signals = snapshot.signals.map((reading) =>
    bySkill.has(reading.skillId) ? { ...reading, value: bySkill.get(reading.skillId)! } : reading,
  );
  return { ...snapshot, signals };
}

/**
 * The catalogue scored with `snapshot`: catalogue.signals[skillId].momentum is
 * each reading's value. `keywords` (the trend's counts) feeds the radar's
 * keyword rows; the prior snapshot stays as bundled.
 */
export function applySignals(catalogue: Catalogue, snapshot: SignalSnapshot, keywords: readonly CatalogueKeyword[] = catalogue.keywords.today): Catalogue {
  const signals: Record<string, CatalogueSignal> = {};
  for (const reading of snapshot.signals) {
    signals[reading.skillId] = {
      momentum: reading.value,
      keywords: keywords.filter((keyword) => keyword.enough && keyword.skillIds.includes(reading.skillId)).map((keyword) => keyword.keyword),
      checkedOn: snapshot.asOf,
    };
  }
  return { ...catalogue, signalsAsOf: snapshot.asOf, signals, keywords: { ...catalogue.keywords, today: [...keywords] } };
}
