import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { catalogueFromSignalsFile } from "@/lib/kpi-signals";
import { bundledSnapshot, toSignalSnapshot } from "@/lib/live-signals";

describe("catalogueFromSignalsFile", () => {
  it("applies a saved /api/signals response to the catalogue", () => {
    const trend = { ...bundledSnapshot(CATALOGUE), asOf: "2026-10-29", refreshed: ["x"] };
    const snapshot = { ...toSignalSnapshot(trend), asOf: "2026-10-29" };
    const skillId = snapshot.signals[0].skillId;
    snapshot.signals[0] = { ...snapshot.signals[0], value: 0.95 };
    const { catalogue, meta } = catalogueFromSignalsFile(
      { snapshot, source: "live", fetchedAt: "2026-10-29T08:05:53.810Z", store: "supabase", warning: null, trend },
      CATALOGUE,
    );
    expect(catalogue.signalsAsOf).toBe("2026-10-29");
    expect(catalogue.signals[skillId].momentum).toBe(0.95);
    expect(catalogue.occupations).toBe(CATALOGUE.occupations);
    expect(meta).toMatchObject({ source: "live (supabase)", asOf: "2026-10-29", refreshed: 1 });
  });

  it("rejects files that are not /api/signals responses", () => {
    expect(() => catalogueFromSignalsFile({ foo: 1 }, CATALOGUE)).toThrow();
  });
});
