// Order role cards by the active scenario's ranking score, highest first.
import type { RoleResult, ScenarioId } from "@/types/contracts";

export function rankRoles(roles: readonly RoleResult[], scenario: ScenarioId): RoleResult[] {
  return [...roles].sort((a, b) => b.byScenario[scenario] - a.byScenario[scenario]);
}
