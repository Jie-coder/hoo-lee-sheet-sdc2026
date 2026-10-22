// Plain-language explanation of one role's score in one scenario, built only
// from the numbers that produced it (see src/lib/analyze.ts).
import type { RoleBreakdown } from "@/lib/analyze";
import { SCORING_PARAMS } from "@/lib/scoring";
import type { RoleResult, ScenarioId } from "@/types/contracts";

const SCENARIO_NAME: Record<ScenarioId, string> = {
  co: "Co-Pilot Economy",
  dis: "Age of Displacement",
  sup: "Supercharged Progress",
};

export function explainRole(role: RoleResult, breakdown: RoleBreakdown, scenario: ScenarioId): string {
  const skills =
    breakdown.relatedSkills > 0
      ? `You have ${breakdown.matchedSkills} of its ${breakdown.essentialSkills} essential skills, and ${breakdown.relatedSkills} more are close to ones you have.`
      : `You have ${breakdown.matchedSkills} of its ${breakdown.essentialSkills} essential skills.`;
  const exposure = `AI exposure ${role.exposure.toFixed(2)}${breakdown.exposureGroupEstimate ? " (occupation group)" : ""}.`;
  const demand = `Demand in ${SCENARIO_NAME[scenario]}: ${breakdown.demand[scenario].toFixed(2)} (illustrative).`;
  const bonus = breakdown.interestMatch ? ` Includes +${SCORING_PARAMS.sdgBonus} for matching your impact interest.` : "";
  return `${skills} ${exposure} ${demand} Score ${role.byScenario[scenario].toFixed(2)}.${bonus}`;
}
