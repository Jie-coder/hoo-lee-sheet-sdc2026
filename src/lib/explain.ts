// Plain-language explanation of one role's score in one scenario, built only
// from the numbers that produced it (see src/lib/analyze.ts).
import type { RoleBreakdown } from "@/lib/analyze";
import { translate, type MessageKey } from "@/lib/i18n";
import { SCORING_PARAMS } from "@/lib/scoring";
import type { RoleResult, ScenarioId } from "@/types/contracts";

type Translate = (key: MessageKey, vars?: Record<string, string>) => string;
const defaultT: Translate = (key, vars) => translate("en", key, vars);

const SCENARIO_LABEL: Record<ScenarioId, MessageKey> = {
  co: "scenarioTabs.coLabel",
  dis: "scenarioTabs.disLabel",
  sup: "scenarioTabs.supLabel",
};

export function explainRole(
  role: RoleResult,
  breakdown: RoleBreakdown,
  scenario: ScenarioId,
  t: Translate = defaultT,
): string {
  const skills =
    breakdown.relatedSkills > 0
      ? t("explain.skillsWithRelated", {
          matched: String(breakdown.matchedSkills),
          essential: String(breakdown.essentialSkills),
          related: String(breakdown.relatedSkills),
        })
      : t("explain.skills", {
          matched: String(breakdown.matchedSkills),
          essential: String(breakdown.essentialSkills),
        });
  const demand = t("explain.demand", {
    scenario: t(SCENARIO_LABEL[scenario]),
    score: breakdown.demand[scenario].toFixed(2),
  });
  const bonus = breakdown.interestMatch
    ? ` ${t("explain.interestBonus", { bonus: String(SCORING_PARAMS.sdgBonus) })}`
    : "";
  return `${skills} ${demand} ${t("explain.score", { score: role.byScenario[scenario].toFixed(2) })}${bonus}`;
}
