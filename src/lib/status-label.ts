// Translates the English status labels produced by analyze.ts's statusFor()
// without changing that module's output (tests depend on it).
import type { MessageKey } from "@/lib/i18n-messages";

type Translate = (key: MessageKey, vars?: Record<string, string>) => string;

const INTEREST_KEYS: Record<string, MessageKey> = {
  environment: "status.interest.environment",
  education: "status.interest.education",
  health: "status.interest.health",
  community: "status.interest.community",
};

const SCENARIO_KEYS: Record<string, MessageKey> = {
  "Co-Pilot": "status.scenario.co",
  Displacement: "status.scenario.dis",
  Supercharged: "status.scenario.sup",
};

const INTEREST_PREFIX = "Matches your interest: ";
const TOP_IN_PREFIX = "Top 3 in ";
const TOP_IN_SUFFIX = " only";
const SCENARIO_SEPARATOR = " and ";

export function localizeStatusLabel(label: string, t: Translate): string {
  if (label === "Robust in all 3 futures") return t("status.robust");

  if (label.startsWith(INTEREST_PREFIX)) {
    const interest = label.slice(INTEREST_PREFIX.length);
    const interestKey = INTEREST_KEYS[interest];
    if (!interestKey) return label;
    return t("status.interest", { interest: t(interestKey) });
  }

  if (label.startsWith(TOP_IN_PREFIX) && label.endsWith(TOP_IN_SUFFIX)) {
    const names = label.slice(TOP_IN_PREFIX.length, -TOP_IN_SUFFIX.length).split(SCENARIO_SEPARATOR);
    const scenarios: string[] = [];
    for (const name of names) {
      const scenarioKey = SCENARIO_KEYS[name];
      if (!scenarioKey) return label;
      scenarios.push(t(scenarioKey));
    }
    return t("status.topIn", { scenarios: scenarios.join(` ${t("status.and")} `) });
  }

  return label;
}
