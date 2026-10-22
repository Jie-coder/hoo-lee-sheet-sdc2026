// Turns demand.csv (Malaysian employment, OpenDOSM) and scenarios.csv (cited
// WEF net-growth figures) into D, the demand term in
// R = 0.5·F + 0.3·D + 0.2·(1 − θ·E) (src/lib/scoring.ts).
//
// This is our model, not a published statistic. Step by step:
//   1. g_c: Malaysian year-on-year growth in employees for cluster c. Each
//      ISCO major group's growth (value / prev_value − 1) is weighted by how
//      many of the cluster's occupations in occupations.csv are in that group.
//   2. m_{k,c}: scenarios.csv demand_multiplier = 1 + WEF net growth / 100.
//   3. Index I_{k,c} = (1 + g_c) · m_{k,c}.
//   4. D_{k,c} = I_{k,c} / (largest I in any scenario), so D is on the 0-1
//      scale the formula expects, and one scale is shared by all three
//      scenarios: a cluster that WEF sees shrinking under Displacement keeps
//      a lower D there than under Co-Pilot.
// No value is rounded.
import { CLUSTER_IDS, type ClusterId, type ScenarioId } from "../../src/types/contracts";
import { yearOnYearGrowth } from "./dosm";
import type { DemandRow, ScenarioRow } from "./row-schemas";

/** Step 1: occupation-weighted Malaysian growth per cluster. Clusters with no demand rows are left out. */
export function clusterGrowth(
  demand: DemandRow[],
  occupations: { cluster: string; iscoCode: string | null }[]
): Map<ClusterId, number> {
  const result = new Map<ClusterId, number>();
  for (const cluster of CLUSTER_IDS) {
    let weighted = 0;
    let weights = 0;
    for (const row of demand.filter((r) => r.cluster === cluster)) {
      // Weight = number of this cluster's occupations in the row's major group.
      const weight = occupations.filter(
        (occupation) => occupation.cluster === cluster && occupation.iscoCode?.trim().charAt(0) === row.iscoMajorGroup
      ).length;
      weighted += weight * yearOnYearGrowth(row.value, row.prevValue);
      weights += weight;
    }
    if (weights > 0) result.set(cluster, weighted / weights);
  }
  return result;
}

export type DemandByScenario = Record<ScenarioId, Partial<Record<ClusterId, number>>>;

/**
 * Steps 2-4. A cluster gets a D in a scenario only when it has both a
 * Malaysian growth figure and a cited multiplier: a missing figure is left
 * out, never filled in.
 */
export function demandByScenario(
  demand: DemandRow[],
  scenarios: ScenarioRow[],
  occupations: { cluster: string; iscoCode: string | null }[]
): DemandByScenario {
  const growth = clusterGrowth(demand, occupations);
  const result = { co: {}, dis: {}, sup: {} } as DemandByScenario;

  // Step 3: the index for every scenario and cluster that has both figures.
  const index: { scenarioId: ScenarioId; cluster: ClusterId; value: number }[] = [];
  for (const row of scenarios) {
    const g = growth.get(row.cluster);
    if (g === undefined) continue;
    index.push({ scenarioId: row.scenarioId, cluster: row.cluster, value: (1 + g) * row.demandMultiplier });
  }

  // Step 4: one shared scale.
  const largest = Math.max(...index.map((entry) => entry.value));
  if (!(largest > 0)) return result;
  for (const entry of index) result[entry.scenarioId][entry.cluster] = entry.value / largest;
  return result;
}
