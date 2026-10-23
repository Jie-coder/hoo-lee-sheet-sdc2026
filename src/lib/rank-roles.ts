// Order role cards by the active scenario's ranking score, highest first.
// Equal scores fall back to higher skill fit, then occupationId, so the
// displayed order is deterministic and never puts a lower fit first on a tie.
import type { RoleResult, ScenarioId } from "@/types/contracts";

export function rankRoles(roles: readonly RoleResult[], scenario: ScenarioId): RoleResult[] {
  return [...roles].sort(
    (a, b) =>
      b.byScenario[scenario] - a.byScenario[scenario] ||
      b.fit - a.fit ||
      (a.occupationId < b.occupationId ? -1 : a.occupationId > b.occupationId ? 1 : 0),
  );
}
