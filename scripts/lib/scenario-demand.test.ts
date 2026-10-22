import { describe, expect, it } from "vitest";
import { SCORING_PARAMS } from "../../src/lib/scoring";
import { CLUSTER_IDS, SCENARIO_IDS } from "../../src/types/contracts";
import { runFile } from "../import-data";
import type { DemandRow, ScenarioRow } from "./row-schemas";
import { clusterGrowth, demandByScenario } from "./scenario-demand";

function demand(overrides: Partial<DemandRow>): DemandRow {
  return {
    cluster: "data_analytics",
    iscoMajorGroup: "2",
    metric: "salaries_wages_recipients_thousands",
    value: 1100,
    period: "2025",
    prevValue: 1000,
    prevPeriod: "2024",
    sourceName: "OpenDOSM Salaries & Wages by Occupation",
    sourceUrl: "https://storage.dosm.gov.my/labour/wages_occupation.csv",
    tableOrDataset: "wages_occupation",
    asOf: "2026-09-21",
    notes: "",
    ...overrides,
  };
}

function scenario(overrides: Partial<ScenarioRow>): ScenarioRow {
  return {
    scenarioId: "co",
    cluster: "data_analytics",
    demandMultiplier: 1,
    theta: 1,
    sourceName: "WEF Future of Jobs Report 2025",
    sourceUrl: "https://reports.weforum.org/docs/WEF_Future_of_Jobs_Report_2025.pdf",
    pageOrFigure: "p.260",
    quoteOrFigure: '"Data Analysts and Scientists": global net growth +41%',
    asOf: "2025-01-07",
    notes: "",
    ...overrides,
  };
}

describe("clusterGrowth", () => {
  it("weights each major group's growth by how many of the cluster's occupations are in it", () => {
    const rows = [
      demand({ cluster: "routine_clerical", iscoMajorGroup: "4", value: 1100, prevValue: 1000 }), // +10%
      demand({ cluster: "routine_clerical", iscoMajorGroup: "5", value: 980, prevValue: 1000 }), // −2%
    ];
    const occupations = [
      { cluster: "routine_clerical", iscoCode: "4132" },
      { cluster: "routine_clerical", iscoCode: "4211" },
      { cluster: "routine_clerical", iscoCode: "5244" },
    ];
    // (2 × 10% + 1 × −2%) / 3 = 6%
    expect(clusterGrowth(rows, occupations).get("routine_clerical")).toBeCloseTo(0.06);
  });

  it("leaves out a cluster with no demand rows instead of guessing", () => {
    expect(clusterGrowth([], [{ cluster: "human_care", iscoCode: "2221" }]).has("human_care")).toBe(false);
  });
});

describe("demandByScenario", () => {
  const occupations = [
    { cluster: "data_analytics", iscoCode: "2511" },
    { cluster: "routine_clerical", iscoCode: "4132" },
  ];
  const rows = [
    demand({ cluster: "data_analytics", iscoMajorGroup: "2", value: 1000, prevValue: 1000 }), // 0%
    demand({ cluster: "routine_clerical", iscoMajorGroup: "4", value: 1000, prevValue: 1000 }), // 0%
  ];

  it("divides (1 + g) × multiplier by the largest index across all scenarios", () => {
    const result = demandByScenario(
      rows,
      [
        scenario({ scenarioId: "sup", cluster: "data_analytics", demandMultiplier: 2 }),
        scenario({ scenarioId: "co", cluster: "data_analytics", demandMultiplier: 1.5 }),
        scenario({ scenarioId: "dis", cluster: "routine_clerical", demandMultiplier: 0.5 }),
      ],
      occupations
    );
    expect(result.sup.data_analytics).toBe(1);
    expect(result.co.data_analytics).toBeCloseTo(0.75);
    // One shared scale: a shrinking cluster in Displacement stays low.
    expect(result.dis.routine_clerical).toBeCloseTo(0.25);
  });

  it("gives no D to a cluster without a multiplier or without Malaysian data", () => {
    const result = demandByScenario(
      rows,
      [scenario({ cluster: "data_analytics" }), scenario({ cluster: "human_care" })],
      occupations
    );
    expect(result.co).toEqual({ data_analytics: 1 });
  });
});

describe("SCORING_PARAMS.demandByCluster", () => {
  it("matches the demand computed from data/demand.csv and data/scenarios.csv (update scoring.ts if this fails)", () => {
    const dir = "data";
    const computed = demandByScenario(
      runFile("demand", dir).validDemand,
      runFile("scenarios", dir).validScenarios,
      runFile("occupations", dir).validOccupations
    );
    for (const cluster of CLUSTER_IDS) {
      for (const scenario of SCENARIO_IDS) {
        // scoring.ts stores 4 decimals.
        expect(SCORING_PARAMS.demandByCluster[cluster][scenario], `${cluster} ${scenario}`).toBeCloseTo(
          computed[scenario][cluster] as number,
          4
        );
      }
    }
  });
});
