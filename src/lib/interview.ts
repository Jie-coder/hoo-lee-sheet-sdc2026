// Pure logic for the mocked 5-turn interview: the turn cap, task-share
// normalisation, and the fixed quick-reply chip sets. No AI calls; the
// "slot filling" is scripted, matching docs/design/wireframes/user-flow.md.
import { MAX_INTERVIEW_TURNS } from "@/types/contracts";
import type { AiUsage, EmploymentStatus, ImpactInterest } from "@/types/contracts";

/** True once `turnsAnswered` has reached the hard cap (section 03 / contracts). */
export function isInterviewDone(turnsAnswered: number): boolean {
  return turnsAnswered >= MAX_INTERVIEW_TURNS;
}

/** Keeps a 1-based turn number inside [1, MAX_INTERVIEW_TURNS]. */
export function clampTurn(turn: number): number {
  return Math.min(Math.max(turn, 1), MAX_INTERVIEW_TURNS);
}

export const HOURS_PER_WEEK_CHIPS = [4, 6, 10, 15] as const;

export const BUDGET_CHIPS = [
  { label: "Free only", value: 0 },
  { label: "Up to RM200", value: 200 },
  { label: "Up to RM500", value: 500 },
  { label: "No limit", value: 2000 },
] as const;

/** Three-level choices for how much time a non-main task takes. */
export const TASK_WEIGHT_LEVELS = [
  { value: "lot", label: "A lot", weight: 0.6 },
  { value: "some", label: "Some", weight: 0.35 },
  { value: "little", label: "A little", weight: 0.15 },
] as const;

/** Multi-select tools that can be picked in turn 3. */
export const TOOL_CHIPS = [
  "Microsoft Office",
  "Google Workspace",
  "Excel/Sheets",
  "Canva",
  "ChatGPT/Claude/Gemini",
  "Zoom/Teams",
  "Accounting software",
  "Other",
] as const;

export const AI_USAGE_CHIPS: ReadonlyArray<{ value: AiUsage; label: string }> = [
  { value: "none", label: "Never used it" },
  { value: "tried", label: "Tried it a few times" },
  { value: "occasional", label: "Use it sometimes" },
  { value: "regular", label: "Use it weekly" },
];

export const EMPLOYMENT_STATUS_CHIPS: ReadonlyArray<{ value: EmploymentStatus; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "underemployed", label: "Underemployed (fewer hours/pay than I want)" },
  { value: "unemployed", label: "Unemployed" },
  { value: "student", label: "Student" },
  { value: "self_employed", label: "Self-employed" },
];

export const PERKESO_CHIPS: ReadonlyArray<{ label: string; value: boolean | undefined }> = [
  { label: "Yes", value: true },
  { label: "No", value: false },
  { label: "Not sure", value: undefined },
];

export const IMPACT_INTEREST_CHIPS: ReadonlyArray<{ value: ImpactInterest; label: string }> = [
  { value: "environment", label: "Environment" },
  { value: "education", label: "Education" },
  { value: "health", label: "Health" },
  { value: "community", label: "Community" },
  { value: "none", label: "No particular cause" },
];

export type InterviewQuestionCopy = { title: string; subtitle?: string; why: string };

export const INTERVIEW_QUESTIONS: Readonly<Record<number, InterviewQuestionCopy>> = {
  1: {
    title: "How many hours a week can you spend learning, and what can you spend on courses?",
    why: "Sets the pace and budget for your pathway plan.",
  },
  2: {
    title: "Which task takes most of your week?",
    subtitle: "I found these tasks in your CV. Pick your main one, then say how much time the others take.",
    why: "The time you spend on each task weights your AI exposure and augmentation scores.",
  },
  3: {
    title: "Which tools do you use, and how much have you used AI tools like ChatGPT?",
    why: "Shows your starting point so the plan doesn't repeat what you already know.",
  },
  4: {
    title: "What's your current work status, and are you registered with PERKESO?",
    why: "Some free government programmes are only open to certain groups.",
  },
  5: {
    title: "Is there a cause you'd like your next role to support?",
    why: "Links your pathway to the UN Sustainable Development Goals it can advance.",
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
export function taskSharesFromLevels(mainIndex: number, levels: string[]): number[] {
  const shares = levels.map((level, index) => {
    if (index === mainIndex) return 1;
    const match = TASK_WEIGHT_LEVELS.find((entry) => entry.value === level);
    return match?.weight ?? 0.35;
  });
  return normalizeTaskShares(shares);
}
