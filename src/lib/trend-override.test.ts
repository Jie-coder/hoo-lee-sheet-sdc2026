import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { bundledSnapshot, toSignalSnapshot } from "@/lib/live-signals";
import { compareOverride, TREND_ROLE_COUNT, DEFAULT_OVERRIDE_PERSONA, personaRef, rankPersona, risingRoleRanking } from "@/lib/trend-override";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";

const persona = { id: PERSONAS.aisyah.id, currentOccupationId: PERSONAS.aisyah.currentOccupationId };
const trend = bundledSnapshot(CATALOGUE);
const signals = { snapshot: toSignalSnapshot(trend), trend };

describe("change-the-data override", () => {
  it("no override means no change", () => {
    const result = compareOverride(CATALOGUE, signals, persona, "co", []);
    expect(result.changes).toEqual([]);
  });

  it("overriding momentum changes the persona scores", () => {
    const overrides = signals.snapshot.signals.map((reading) => ({ skillId: reading.skillId, momentum: -3 }));
    const result = compareOverride(CATALOGUE, signals, persona, "co", overrides);
    const before = new Map(result.before.map((role) => [role.occupationId, role.byScenario.co]));
    expect(result.after.some((role) => role.byScenario.co !== before.get(role.occupationId))).toBe(true);
  });

  it("a surge on one skill can reorder the rising roles", () => {
    const before = risingRoleRanking(CATALOGUE, signals).map((role) => role.occupationId).join();
    const changed = signals.snapshot.signals.some(
      (reading) =>
        risingRoleRanking(CATALOGUE, signals, [{ skillId: reading.skillId, momentum: 5 }]).map((role) => role.occupationId).join() !== before,
    );
    expect(changed).toBe(true);
  });

  it("persona ranking is ordered by the score the panel shows", () => {
    const { before } = compareOverride(CATALOGUE, signals, persona, "co", []);
    for (let i = 1; i < before.length; i++) {
      expect(before[i - 1].byScenario.co).toBeGreaterThanOrEqual(before[i].byScenario.co);
    }
  });

  it("selecting a persona changes the ranked list input", () => {
    expect(DEFAULT_OVERRIDE_PERSONA).toBe("aisyah");
    expect(personaRef("aisyah")).toEqual(persona);
    const lists = PERSONA_IDS.map((id) => {
      const ref = personaRef(id);
      expect(ref.id).toBe(PERSONAS[id].id);
      return rankPersona(CATALOGUE, signals, ref, "co").map((role) => `${role.occupationId}:${role.byScenario.co.toFixed(4)}`).join();
    });
    expect(new Set(lists).size).toBe(PERSONA_IDS.length);
  });

  it("reports a strict position swap even when scores are within 0.005 (Pravin, computer programming -0.320)", () => {
    const pravin = personaRef("pravin");
    const skillId = signals.snapshot.signals.find((reading) => CATALOGUE.skills[reading.skillId] === "computer programming")!.skillId;
    const result = compareOverride(CATALOGUE, signals, pravin, "co", [{ skillId, momentum: -0.32 }]);
    const top = (roles: typeof result.before) => roles.slice(0, 2).map((role) => role.title);
    expect(top(result.before)).toEqual(["Mobile application developer", "Environmental scientist"]);
    expect(top(result.after)).toEqual(["Environmental scientist", "Mobile application developer"]);
    // The two are within the old 0.005 tie band, so a tie rule would hide this swap.
    expect(Math.abs(result.after[0].byScenario.co - result.after[1].byScenario.co)).toBeLessThan(0.005);
    const moves = new Map(result.changes.map((change) => [change.title, [change.before, change.after]]));
    expect(moves.get("Mobile application developer")).toEqual([1, 2]);
    expect(moves.get("Environmental scientist")).toEqual([2, 1]);
  });

  it("trend-momentum roles are not empty when every role's momentum is <= 0", () => {
    const allDown = signals.snapshot.signals.map((reading) => ({ skillId: reading.skillId, momentum: -1 }));
    const roles = risingRoleRanking(CATALOGUE, signals, allDown);
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.length).toBeLessThanOrEqual(TREND_ROLE_COUNT);
    expect(roles.every((role) => role.momentum <= 0)).toBe(true);
    expect(risingRoleRanking(CATALOGUE, signals).length).toBeGreaterThan(0);
    for (let i = 1; i < roles.length; i++) expect(roles[i - 1].momentum).toBeGreaterThanOrEqual(roles[i].momentum);
  });
});
