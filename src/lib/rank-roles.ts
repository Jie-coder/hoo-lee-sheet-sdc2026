// Order role cards by the active scenario's ranking score, highest first.
// This is a strict comparator: ties are broken only by occupationId ascending,
// with no near-tie epsilon.
import type { ScenarioId, ScenarioScores } from "@/types/contracts";

/** The fields rankRoles needs; RoleResult satisfies this structurally. */
export type RankableRole = {
  occupationId: string;
  byScenario: ScenarioScores;
  fit: number;
};

export function rankRoles<T extends RankableRole>(
  roles: readonly T[],
  scenario: ScenarioId,
): T[] {
  return [...roles].sort(
    (a, b) =>
      b.byScenario[scenario] - a.byScenario[scenario] ||
      (a.occupationId < b.occupationId ? -1 : a.occupationId > b.occupationId ? 1 : 0),
  );
}
