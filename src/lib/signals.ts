// THE loader for trend signals. Every score and ranking (/api/roles, /radar,
// /data-sources) goes through getActiveSignals(), so they all move together
// when the data changes.
//
// Contract (other modules depend on it):
//   getActiveSignals(): Promise<ActiveSignals>
//     snapshot  SignalSnapshot from src/types/contracts.ts (one "momentum"
//               reading per skill; reading.value is the momentum)
//     source    "live"      newest stored arXiv snapshot, last refresh OK
//               "last-good" a stored snapshot kept because the latest refresh
//                           or the database read failed
//               "bundled"   counts shipped in src/data/catalogue.json
//     fetchedAt ISO timestamp of that fetch
//   catalogueFor(active, overrides?) -> Catalogue whose
//     signals[skillId].momentum = reading.value (scoring.ts is unchanged).
import "server-only";
import type { Catalogue } from "@/lib/catalogue";
import { CATALOGUE } from "@/lib/catalogue";
import {
  applyMomentumOverrides,
  applySignals,
  toSignalSnapshot,
  type MomentumOverride,
  type TrendSnapshot,
} from "@/lib/live-signals";
import { getActiveSnapshot, refreshFailureSince } from "@/lib/signal-store";
import type { SignalSnapshot } from "@/types/contracts";

export type SignalOrigin = "live" | "last-good" | "bundled";

export type ActiveSignals = {
  snapshot: SignalSnapshot;
  source: SignalOrigin;
  fetchedAt: string;
  /** Where a stored snapshot lives; null for bundled. */
  store: "supabase" | "local" | null;
  /** Why we fell back, when we did. */
  warning: string | null;
  /** The keyword counts behind the snapshot (radar rows, the source line). */
  trend: TrendSnapshot;
};

export async function getActiveSignals(): Promise<ActiveSignals> {
  const active = await getActiveSnapshot();
  const failure = active.origin === "live" ? refreshFailureSince(active.snapshot.fetchedAt) : null;
  const source: SignalOrigin = active.origin === "bundled" ? "bundled" : active.warning || failure ? "last-good" : "live";
  return {
    snapshot: toSignalSnapshot(active.snapshot),
    source,
    fetchedAt: active.snapshot.fetchedAt,
    store: active.store,
    warning: active.warning ?? (failure ? `Latest refresh failed: ${failure.error}` : null),
    trend: active.snapshot,
  };
}

/** The bundled catalogue scored with these signals (plus optional per-request momentum overrides). */
export function catalogueFor(active: Pick<ActiveSignals, "snapshot" | "trend">, overrides: readonly MomentumOverride[] = [], base: Catalogue = CATALOGUE): Catalogue {
  return applySignals(base, applyMomentumOverrides(active.snapshot, overrides), active.trend.keywords);
}
