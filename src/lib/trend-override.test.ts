import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { bundledSnapshot, toSignalSnapshot } from "@/lib/live-signals";
import { compareOverride, DEFAULT_OVERRIDE_PERSONA, personaRef, rankPersona, risingRoleRanking } from "@/lib/trend-override";
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
});
