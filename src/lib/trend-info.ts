// What the trend source line shows, taken from getActiveSignals() (types only, safe in the browser).
import { TREND_SOURCE_NAME } from "@/lib/live-signals";
import type { ActiveSignals } from "@/lib/signals";

export type TrendInfo = Pick<ActiveSignals, "source" | "fetchedAt" | "store" | "warning"> & {
  provider: string;
  refreshedCount: number;
  total: number;
};

export function trendInfo(active: ActiveSignals): TrendInfo {
  return {
    source: active.source,
    provider: TREND_SOURCE_NAME,
    fetchedAt: active.fetchedAt,
    store: active.store,
    warning: active.warning,
    refreshedCount: active.trend.refreshed.length,
    total: active.trend.keywords.length,
  };
}
