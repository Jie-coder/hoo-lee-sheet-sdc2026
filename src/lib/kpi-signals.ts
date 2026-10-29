// KPI script helper: turn a saved /api/signals response (ActiveSignals JSON:
// { snapshot, source, fetchedAt, store, warning, trend }) into the scored
// Catalogue, the same way catalogueFor() in signals.ts does (no overrides).
// Kept separate from signals.ts because that module is "server-only".
import type { Catalogue } from "@/lib/catalogue";
import { applySignals, isTrendSnapshot, type TrendSnapshot } from "@/lib/live-signals";
import type { SignalSnapshot } from "@/types/contracts";

export type SignalsFile = {
  snapshot: SignalSnapshot;
  source: string;
  fetchedAt: string;
  store: string | null;
  warning: string | null;
  trend: TrendSnapshot;
};

export type LoadedSignals = {
  catalogue: Catalogue;
  meta: { source: string; store: string | null; fetchedAt: string; asOf: string; refreshed: number; keywords: number };
};

export function catalogueFromSignalsFile(json: unknown, base: Catalogue): LoadedSignals {
  const file = json as Partial<SignalsFile>;
  if (!file || typeof file !== "object" || !file.snapshot || !Array.isArray(file.snapshot.signals) || !isTrendSnapshot(file.trend)) {
    throw new Error("signals file must be an /api/signals response with snapshot.signals and trend.keywords");
  }
  return {
    catalogue: applySignals(base, file.snapshot, file.trend.keywords),
    meta: {
      source: `${file.source ?? "unknown"}${file.store ? ` (${file.store})` : ""}`,
      store: file.store ?? null,
      fetchedAt: file.fetchedAt ?? file.trend.fetchedAt,
      asOf: file.snapshot.asOf,
      refreshed: file.trend.refreshed?.length ?? 0,
      keywords: file.trend.keywords.length,
    },
  };
}
