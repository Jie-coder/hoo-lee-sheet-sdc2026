// --apply for demand.csv (public.cluster_demand) and scenarios.csv
// (public.scenarios). Kept apart from apply.test.ts so each file stays short.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyImport,
  buildClusterDemandRows,
  buildScenarioRows,
  CLUSTER_DEMAND_ON_CONFLICT,
  SCENARIO_TEXT,
  type ApplyInput,
} from "./apply";
import type { Embedder } from "./clients";
import type { DemandRow, OccupationRow, ScenarioRow, SourceRow } from "./row-schemas";

const occupation: OccupationRow = {
  id: "o001",
  escoUri: null,
  iscoCode: "2511",
  titleEn: "data analyst",
  titleMs: "penganalisis data",
  description: "",
  cluster: "data_analytics",
  isEmerging: false,
  lastChecked: "2026-10-01",
  notes: "",
};

const demandRow: DemandRow = {
  cluster: "data_analytics",
  iscoMajorGroup: "2",
  metric: "salaries_wages_recipients_thousands",
  value: 1945.4,
  period: "2025",
  prevValue: 1895.8,
  prevPeriod: "2024",
  sourceName: "OpenDOSM Salaries & Wages by Occupation",
  sourceUrl: "https://storage.dosm.gov.my/labour/wages_occupation.csv",
  tableOrDataset: "wages_occupation, sex=both, occupation=professionals",
  asOf: "2026-09-21",
  notes: "",
};

const scenario = (scenarioId: ScenarioRow["scenarioId"], demandMultiplier: number, theta: number): ScenarioRow => ({
  scenarioId,
  cluster: "data_analytics",
  demandMultiplier,
  theta,
  sourceName: "WEF Future of Jobs Report 2025",
  sourceUrl: "https://reports.weforum.org/docs/WEF_Future_of_Jobs_Report_2025.pdf",
  pageOrFigure: "p.260",
  quoteOrFigure: '"Data Analysts and Scientists": global net growth +41%',
  asOf: "2025-01-07",
  notes: "",
});

const source: SourceRow = {
  name: "OpenDOSM Salaries & Wages by Occupation",
  url: "https://open.dosm.gov.my/data-catalogue/wages_occupation",
  publisher: "DOSM",
  whatItMeasures: "Employees by occupation group",
  updateFrequency: "Annual",
  lastUpdated: "2026-09-21",
  dataFormat: "CSV",
  licence: "CC BY 4.0",
  useFor: "demand",
  notes: "",
};

const INPUT: ApplyInput = {
  courses: [],
  programmes: [],
  occupations: [occupation],
  skills: [],
  signals: [],
  sources: [source],
  exposure: [],
  occupationSkills: [],
  demand: [demandRow],
  scenarios: [scenario("co", 1.27, 1), scenario("dis", 1.03, 1.4), scenario("sup", 1.41, 1.2)],
};

function fakeSupabase(errorFor: Record<string, { code: string; message: string }> = {}) {
  const upserts: { table: string; rows: Record<string, unknown>[]; onConflict?: string }[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(rows: Record<string, unknown>[], options?: { onConflict?: string }) {
          upserts.push({ table, rows, onConflict: options?.onConflict });
          return Promise.resolve({ error: errorFor[table] ?? null });
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        select: () => ({ in: () => Promise.resolve({ data: [] }) }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, upserts };
}

const embedder: Embedder = vi.fn(async (texts: string[]) => texts.map(() => [0]));

describe("buildClusterDemandRows", () => {
  it("copies demand.csv as-is into snake_case columns", () => {
    expect(buildClusterDemandRows([demandRow])).toEqual([
      {
        cluster: "data_analytics",
        isco_major_group: "2",
        metric: "salaries_wages_recipients_thousands",
        value: 1945.4,
        period: "2025",
        prev_value: 1895.8,
        prev_period: "2024",
        source_name: "OpenDOSM Salaries & Wages by Occupation",
        source_url: "https://storage.dosm.gov.my/labour/wages_occupation.csv",
        table_or_dataset: "wages_occupation, sex=both, occupation=professionals",
        as_of: "2026-09-21",
        notes: "",
      },
    ]);
  });
});

describe("buildScenarioRows", () => {
  it("builds one public.scenarios row per scenario, with its theta and computed demand", () => {
    const rows = buildScenarioRows(INPUT.scenarios, INPUT.demand, INPUT.occupations);
    expect(rows.map((row) => [row.id, row.theta])).toEqual([
      ["co", 1],
      ["dis", 1.4],
      ["sup", 1.2],
    ]);
    // sup has the largest index, so it is 1; the others are on the same scale.
    const sup = rows[2].demand_by_cluster as Record<string, number>;
    const co = rows[0].demand_by_cluster as Record<string, number>;
    expect(sup.data_analytics).toBe(1);
    expect(co.data_analytics).toBeCloseTo(1.27 / 1.41);
    expect(rows[0]).toMatchObject({ name: SCENARIO_TEXT.co.name, assumptions_en: SCENARIO_TEXT.co.en });
  });

  it("builds nothing when demand.csv or occupations.csv is missing (no guessed demand)", () => {
    expect(buildScenarioRows(INPUT.scenarios, [], INPUT.occupations)).toEqual([]);
    expect(buildScenarioRows(INPUT.scenarios, INPUT.demand, [])).toEqual([]);
  });
});

describe("applyImport: cluster_demand and scenarios", () => {
  it("upserts cluster_demand after sources (foreign key) on its primary key", async () => {
    const { client, upserts } = fakeSupabase();
    await applyImport(INPUT, client, embedder);
    const tables = upserts.map((upsert) => upsert.table);
    expect(tables.indexOf("sources")).toBeLessThan(tables.indexOf("cluster_demand"));
    expect(upserts.find((upsert) => upsert.table === "cluster_demand")?.onConflict).toBe(CLUSTER_DEMAND_ON_CONFLICT);
    expect(upserts.find((upsert) => upsert.table === "scenarios")?.rows).toHaveLength(3);
  });

  it("says which migration to apply when cluster_demand does not exist yet, and carries on", async () => {
    const { client, upserts } = fakeSupabase({
      cluster_demand: { code: "PGRST205", message: "Could not find the table 'public.cluster_demand'" },
    });
    const result = await applyImport(INPUT, client, embedder);
    const failed = result.tables.find((table) => table.table === "cluster_demand");
    expect(failed?.error).toContain("apply migration 20261022090000 first");
    expect(upserts.some((upsert) => upsert.table === "occupation_skills" || upsert.table === "scenarios")).toBe(true);
  });
});
