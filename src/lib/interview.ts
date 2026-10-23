// Pure logic for the mocked 5-turn interview: the turn cap, task-share
// normalisation, and the fixed quick-reply chip sets. No AI calls; the
// "slot filling" is scripted, matching docs/design/wireframes/user-flow.md.
import { MAX_INTERVIEW_TURNS } from "@/types/contracts";
import type { AiUsage, EmploymentStatus, ImpactInterest } from "@/types/contracts";
import type { MessageKey } from "@/lib/i18n-messages";

/** True once `turnsAnswered` has reached the hard cap (section 03 / contracts). */
export function isInterviewDone(turnsAnswered: number): boolean {
  return turnsAnswered >= MAX_INTERVIEW_TURNS;
}

/** Keeps a 1-based turn number inside [1, MAX_INTERVIEW_TURNS]. */
export function clampTurn(turn: number): number {
  return Math.min(Math.max(turn, 1), MAX_INTERVIEW_TURNS);
}

export const HOURS_PER_WEEK_CHIPS = [4, 6, 10, 15] as const;

export const BUDGET_CHIPS: ReadonlyArray<{ labelKey: MessageKey; value: number }> = [
  { labelKey: "interview.budgetFreeOnly", value: 0 },
  { labelKey: "interview.budgetUpTo200", value: 200 },
  { labelKey: "interview.budgetUpTo500", value: 500 },
  { labelKey: "interview.budgetNoLimit", value: 2000 },
];

/** Three-level choices for how much time a non-main task takes. */
export const TASK_WEIGHT_LEVELS: ReadonlyArray<{ value: string; labelKey: MessageKey; weight: number }> = [
  { value: "lot", labelKey: "interview.weightLot", weight: 0.6 },
  { value: "some", labelKey: "interview.weightSome", weight: 0.35 },
  { value: "little", labelKey: "interview.weightLittle", weight: 0.15 },
];

/** Multi-select tools that can be picked in turn 3. */
export const TOOL_CHIPS: ReadonlyArray<{ value: string; labelKey: MessageKey }> = [
  { value: "Microsoft Office", labelKey: "interview.toolMicrosoftOffice" },
  { value: "Google Workspace", labelKey: "interview.toolGoogleWorkspace" },
  { value: "Excel/Sheets", labelKey: "interview.toolExcelSheets" },
  { value: "Canva", labelKey: "interview.toolCanva" },
  { value: "ChatGPT/Claude/Gemini", labelKey: "interview.toolChatGpt" },
  { value: "Zoom/Teams", labelKey: "interview.toolZoomTeams" },
  { value: "Accounting software", labelKey: "interview.toolAccounting" },
  { value: "Other", labelKey: "interview.toolOther" },
];

export const AI_USAGE_CHIPS: ReadonlyArray<{ value: AiUsage; labelKey: MessageKey }> = [
  { value: "none", labelKey: "interview.aiUsageNone" },
  { value: "tried", labelKey: "interview.aiUsageTried" },
  { value: "occasional", labelKey: "interview.aiUsageOccasional" },
  { value: "regular", labelKey: "interview.aiUsageRegular" },
];

export const EMPLOYMENT_STATUS_CHIPS: ReadonlyArray<{ value: EmploymentStatus; labelKey: MessageKey }> = [
  { value: "employed", labelKey: "interview.employmentEmployed" },
  { value: "underemployed", labelKey: "interview.employmentUnderemployed" },
  { value: "unemployed", labelKey: "interview.employmentUnemployed" },
  { value: "student", labelKey: "interview.employmentStudent" },
  { value: "self_employed", labelKey: "interview.employmentSelfEmployed" },
];

export const PERKESO_CHIPS: ReadonlyArray<{ labelKey: MessageKey; value: boolean | undefined }> = [
  { labelKey: "interview.perkesoYes", value: true },
  { labelKey: "interview.perkesoNo", value: false },
  { labelKey: "interview.perkesoNotSure", value: undefined },
];

export const IMPACT_INTEREST_CHIPS: ReadonlyArray<{ value: ImpactInterest; labelKey: MessageKey }> = [
  { value: "environment", labelKey: "interview.impactEnvironment" },
  { value: "education", labelKey: "interview.impactEducation" },
  { value: "health", labelKey: "interview.impactHealth" },
  { value: "community", labelKey: "interview.impactCommunity" },
  { value: "none", labelKey: "interview.impactNone" },
];

export type InterviewQuestionCopy = { titleKey: MessageKey; subtitleKey?: MessageKey; whyKey: MessageKey };

export const INTERVIEW_QUESTIONS: Readonly<Record<number, InterviewQuestionCopy>> = {
  1: {
    titleKey: "interview.q1.title",
    whyKey: "interview.q1.why",
  },
  2: {
    titleKey: "interview.q2.title",
    subtitleKey: "interview.q2.subtitle",
    whyKey: "interview.q2.why",
  },
  3: {
    titleKey: "interview.q3.title",
    whyKey: "interview.q3.why",
  },
  4: {
    titleKey: "interview.q4.title",
    whyKey: "interview.q4.why",
  },
  5: {
    titleKey: "interview.q5.title",
    whyKey: "interview.q5.why",
  },
};

/** Even split across `count` tasks, summing to 1. */
export function splitTaskSharesEvenly(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => 1 / count);
}

/**
 * Scales raw chip shares so they sum to 1 (the contract's task-share rule).
 * All-zero input falls back to an even split instead of dividing by zero.
 */
export function normalizeTaskShares(shares: readonly number[]): number[] {
  const total = shares.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return splitTaskSharesEvenly(shares.length);
  return shares.map((value) => value / total);
}

/**
 * Task shares from a main task plus a weight level for each other task.
 * The main task weighs 1.0; others use their level weight, then normalise.
 */
/**
 * Task weight levels after "Main task" leaves row `previousMain`: that row's
 * weight chips are enabled again, keeping the level it had or "lot" if none.
 */
export function levelsAfterMainTaskMove(levels: string[], previousMain: number): string[] {
  return levels.map((level, index) => (index === previousMain && !level ? "lot" : level));
}

export function taskSharesFromLevels(mainIndex: number, levels: string[]): number[] {
  const shares = levels.map((level, index) => {
    if (index === mainIndex) return 1;
    const match = TASK_WEIGHT_LEVELS.find((entry) => entry.value === level);
    return match?.weight ?? 0.35;
  });
  return normalizeTaskShares(shares);
}
