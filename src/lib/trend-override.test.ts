import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { bundledSnapshot, toSignalSnapshot } from "@/lib/live-signals";
import { compareOverride, risingRoleRanking } from "@/lib/trend-override";
import { PERSONAS } from "@/mocks/personas";

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
});
