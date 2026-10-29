import { describe, expect, it } from "vitest";
import { clampAdoptionSpeed, ADOPTION_SPEED } from "./adoption";
import { rankScore } from "./scoring";
import { analyzeProfile } from "./analyze";
import { CATALOGUE } from "./catalogue";
import { resolveProfileSkills } from "./profile-skills";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";

describe("clampAdoptionSpeed", () => {
  it("clamps to the slider range", () => {
    expect(clampAdoptionSpeed(5)).toBe(2);
    expect(clampAdoptionSpeed(0)).toBe(0.5);
    expect(clampAdoptionSpeed(1.5)).toBe(1.5);
  });

  it("falls back to the default for non-finite input", () => {
    expect(clampAdoptionSpeed(NaN)).toBe(1);
    expect(clampAdoptionSpeed(ADOPTION_SPEED.default)).toBe(1);
  });
});

describe("rankScore", () => {
  it.each([0, 0.25, 0.5, 1, 1.5])(
    "equals fit when momentum is 0 (fit %s)",
    (fit) => {
      for (const adoption of [0.5, 1, 2]) {
        expect(rankScore(fit, 0, adoption)).toBe(fit);
      }
    },
  );

  it("scales with adoption for positive momentum", () => {
    const fit = 0.5;
    const momentum = 0.8;
    const half = rankScore(fit, momentum, 0.5);
    const one = rankScore(fit, momentum, 1);
    const two = rankScore(fit, momentum, 2);
    expect(two).toBeGreaterThan(one);
    expect(one).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(fit);
  });
});

function personaInput(id: (typeof PERSONA_IDS)[number], adoption?: number) {
  const persona = PERSONAS[id];
  const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
  const { skills } = resolveProfileSkills(CATALOGUE, id, chips);
  return { skills, currentOccupationId: persona.currentOccupationId, impactInterest: "none" as const, adoption };
}

describe("adoption 1 is the default", () => {
  it.each(PERSONA_IDS)("analyzeProfile with adoption 1 matches the default for %s", (id) => {
    const baseline = analyzeProfile(CATALOGUE, personaInput(id));
    expect(analyzeProfile(CATALOGUE, personaInput(id, 1))).toEqual(baseline);
  });

  it.each(PERSONA_IDS)("clampAdoptionSpeed(1) matches the default for %s", (id) => {
    const baseline = analyzeProfile(CATALOGUE, personaInput(id));
    expect(analyzeProfile(CATALOGUE, personaInput(id, clampAdoptionSpeed(1)))).toEqual(baseline);
  });
});
