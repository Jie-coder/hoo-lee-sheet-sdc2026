// What the trend source line shows, taken from getActiveSignals() (types only, safe in the browser).
import { TREND_SOURCE_NAME, carriedOverFrom } from "@/lib/live-signals";
import type { IsoDate } from "@/types/contracts";
import type { ActiveSignals } from "@/lib/signals";

export type TrendInfo = Pick<ActiveSignals, "source" | "fetchedAt" | "store" | "warning"> & {
  provider: string;
  refreshedCount: number;
  total: number;
  /** MYT date of the oldest keyword counts carried over unchanged, or null. */
  carriedFrom: IsoDate | null;
  /** Finals freeze (TREND_REFRESH_LOCKED on the server): the Refresh button is disabled. */
  refreshLocked: boolean;
};

export function trendInfo(active: ActiveSignals, { refreshLocked = false }: { refreshLocked?: boolean } = {}): TrendInfo {
  return {
    source: active.source,
    provider: TREND_SOURCE_NAME,
    fetchedAt: active.fetchedAt,
    store: active.store,
    warning: active.warning,
    refreshedCount: active.trend.refreshed.length,
    total: active.trend.keywords.length,
    carriedFrom: active.source === "bundled" ? null : carriedOverFrom(active.trend),
    refreshLocked,
  };
}
