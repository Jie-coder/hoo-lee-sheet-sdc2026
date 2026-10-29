import { describe, expect, it } from "vitest";

import { CATALOGUE } from "./catalogue";
import { computeFitCalibrationDenominator } from "./fit-calibration";
import { resolveProfileSkills } from "./profile-skills";
import { SCORING_PARAMS } from "./scoring";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";

function personaSkills(id: (typeof PERSONA_IDS)[number]) {
  const persona = PERSONAS[id];
  const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
  return resolveProfileSkills(CATALOGUE, id, chips).skills;
}

describe("computeFitCalibrationDenominator", () => {
  it("matches the pinned global fit calibration denominator", () => {
    const profiles = PERSONA_IDS.map(personaSkills);
    const denominator = computeFitCalibrationDenominator(CATALOGUE, profiles);
    console.log("fitCalibrationDenominator", denominator);
    expect(denominator).toBeCloseTo(SCORING_PARAMS.fitCalibrationDenominator, 4);
  });
});
