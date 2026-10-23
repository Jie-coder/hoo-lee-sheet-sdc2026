// Order role cards by the active scenario's ranking score, highest first.
// Scores within SCORE_TIE_EPSILON of each other count as a tie and fall back to
// the displayed Fit (higher first), then raw skill fit, then occupationId, so the
// order on screen never puts a visibly lower Fit first on a near-tie.
import type { RoleResult, ScenarioId } from "@/types/contracts";

export const SCORE_TIE_EPSILON = 0.005;

export function rankRoles(
  roles: readonly RoleResult[],
  scenario: ScenarioId,
  displayFitOf: (role: RoleResult) => number = (role) => role.fit,
): RoleResult[] {
  return [...roles].sort((a, b) => {
    const diff = b.byScenario[scenario] - a.byScenario[scenario];
    if (Math.abs(diff) >= SCORE_TIE_EPSILON) return diff;
    return (
      displayFitOf(b) - displayFitOf(a) ||
      diff ||
      b.fit - a.fit ||
      (a.occupationId < b.occupationId ? -1 : a.occupationId > b.occupationId ? 1 : 0)
    );
  });
}
