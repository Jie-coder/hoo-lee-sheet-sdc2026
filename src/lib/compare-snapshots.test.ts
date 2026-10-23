import { describe, expect, it } from "vitest";
import { analyzeProfile } from "./analyze";
import { CATALOGUE } from "./catalogue";
import { describeChange, rankChanges } from "./compare-snapshots";
import { resolveProfileSkills } from "./profile-skills";
import { PERSONAS } from "@/mocks/personas";
import type { RoleResult } from "@/types/contracts";

function role(occupationId: string, co: number): RoleResult {
  return { occupationId, title: occupationId.toUpperCase(), byScenario: { co, dis: co, sup: co } } as RoleResult;
}

describe("rankChanges", () => {
  it("lists moved, new and dropped roles, biggest move first", () => {
    const before = [role("a", 0.9), role("b", 0.8), role("c", 0.7)];
    const after = [role("b", 0.95), role("a", 0.9), role("d", 0.6)];
    const changes = rankChanges(before, after, "co");
    expect(changes.map((change) => describeChange(change))).toEqual([
      "C: drops out of the list (was #3)",
      "D: new in the list at #3",
      "A #1 → #2",
      "B #2 → #1",
    ]);
  });

  it("is empty when the order is the same", () => {
    expect(rankChanges([role("a", 0.9), role("b", 0.8)], [role("a", 0.7), role("b", 0.6)], "co")).toEqual([]);
  });
});

describe("analyzeProfile with two signal snapshots", () => {
  // Lim Jia Hui: once routine_clerical roles are excluded, her top roles carry
  // skills whose arXiv momentum differs between the two snapshots.
  const persona = PERSONAS["lim-jia-hui"];
  const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
  const { skills } = resolveProfileSkills(CATALOGUE, persona.id, chips);
  const input = { skills, currentOccupationId: persona.currentOccupationId, impactInterest: "none" as const };

  it("dates every role and source chip with the chosen snapshot", () => {
    expect(CATALOGUE.priorSignalsAsOf).not.toBeNull();
    const prior = analyzeProfile(CATALOGUE, { ...input, signalDate: "prior" });
    const today = analyzeProfile(CATALOGUE, { ...input, signalDate: "today" });
    expect(prior.signalDate).toBe("prior");
    expect(prior.signalsAsOf).toBe(CATALOGUE.priorSignalsAsOf);
    expect(today.signalsAsOf).toBe(CATALOGUE.signalsAsOf);
    expect(prior.signalsAsOf < today.signalsAsOf).toBe(true);
    for (const result of [prior, today]) {
      for (const item of result.roles) {
        expect(item.signalsAsOf).toBe(result.signalsAsOf);
        expect(item.sources.find((source) => source.dataset === "arXiv API")?.asOf).toBe(result.signalsAsOf);
      }
    }
  });

  it("scores differently when the trend data differs (the toggle moves the output)", () => {
    const prior = analyzeProfile(CATALOGUE, { ...input, signalDate: "prior" });
    const today = analyzeProfile(CATALOGUE, { ...input, signalDate: "today" });
    const scores = (result: typeof prior) => result.roles.map((item) => `${item.occupationId}:${item.byScenario.co}`).join();
    expect(scores(prior)).not.toBe(scores(today));
  });

  it("falls back to today when no prior snapshot was collected", () => {
    const result = analyzeProfile({ ...CATALOGUE, priorSignals: null, priorSignalsAsOf: null }, { ...input, signalDate: "prior" });
    expect(result.signalDate).toBe("today");
    expect(result.signalDates.prior).toBeNull();
  });
});
