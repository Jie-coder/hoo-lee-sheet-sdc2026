// Shared Laluan contracts. Zod schemas are the source of truth; TypeScript
// types below are inferred from them. Client and server both import this module.
// There is no login and no CV file storage, so nothing here has user_id or cv_path.
import { z } from "zod";

/** Calendar date YYYY-MM-DD. This is the brief's as_of and release-date grain. */
export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** A score in [0, 1]: exposure, augmentation, fit, or SDG confidence. */
export const UnitScoreSchema = z.number().min(0).max(1);
export type UnitScore = z.infer<typeof UnitScoreSchema>;

/**
 * Band cut points from section 05. Low is below lowBelow, high is above highAbove,
 * and both boundaries themselves are Medium.
 */
export const SCORE_BAND_THRESHOLDS = { lowBelow: 0.33, highAbove: 0.66 } as const;

/** Low / Medium / High band for a unit score. 0.33 and 0.66 are Medium. */
export function scoreBand(value: number): "low" | "medium" | "high" {
  if (value < SCORE_BAND_THRESHOLDS.lowBelow) return "low";
  if (value > SCORE_BAND_THRESHOLDS.highAbove) return "high";
  return "medium";
}

/** SDG target id such as "8.6" or "1.a". Goal-only labels ("8", "SDG 8") are rejected. */
export const SdgTargetIdSchema = z
  .string()
  .regex(/^(?:[1-9]|1[0-7])\.(?:[1-9]|1[0-9]|[a-z])$/);
export type SdgTargetId = z.infer<typeof SdgTargetIdSchema>;

/** Scenario ids: Co-Pilot Economy, Age of Displacement, Supercharged Progress. */
export const SCENARIO_IDS = ["co", "dis", "sup"] as const;
export const ScenarioIdSchema = z.enum(SCENARIO_IDS);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

/** Occupation cluster id: key into scenarios.demand_by_cluster and occupations.cluster. */
export const CLUSTER_IDS = [
  "ai_digital",
  "data_analytics",
  "green_sustainability",
  "human_care",
  "routine_clerical",
] as const;
export const ClusterIdSchema = z.enum(CLUSTER_IDS);
export type ClusterId = z.infer<typeof ClusterIdSchema>;

/**
 * Pathway cost tags, in the section 07 ordering: free, then subsidised,
 * then HRD Corp claimable, then paid.
 */
export const COST_TYPES = ["free", "subsidised", "hrdcorp_claimable", "paid"] as const;
export const CostTypeSchema = z.enum(COST_TYPES);
export type CostType = z.infer<typeof CostTypeSchema>;

/** Study or course language: English, Bahasa Melayu, or Chinese. */
export const LANGUAGE_CODES = ["en", "ms", "zh"] as const;
export const LanguageCodeSchema = z.enum(LANGUAGE_CODES);
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

/** How the user already uses AI tools. Sets a starting level, not a score. */
export const AI_USAGE_LEVELS = ["none", "tried", "occasional", "regular"] as const;
export const AiUsageSchema = z.enum(AI_USAGE_LEVELS);
export type AiUsage = z.infer<typeof AiUsageSchema>;

/** Age bands the interview offers as chips. Ranges are inclusive. "55+" has no max. */
export const AGE_BANDS = ["18-24", "25-29", "30-34", "35-44", "45-54", "55+"] as const;
export const AgeBandSchema = z.enum(AGE_BANDS);
export type AgeBand = z.infer<typeof AgeBandSchema>;

export const AGE_BAND_RANGES: Record<AgeBand, { min: number; max: number | null }> = {
  "18-24": { min: 18, max: 24 },
  "25-29": { min: 25, max: 29 },
  "30-34": { min: 30, max: 34 },
  "35-44": { min: 35, max: 44 },
  "45-54": { min: 45, max: 54 },
  "55+": { min: 55, max: null },
};

/** Malaysian state or federal territory, matched against programme eligibility. */
export const MALAYSIA_STATES = [
  "johor",
  "kedah",
  "kelantan",
  "melaka",
  "negeri_sembilan",
  "pahang",
  "perak",
  "perlis",
  "pulau_pinang",
  "sabah",
  "sarawak",
  "selangor",
  "terengganu",
  "kuala_lumpur",
  "labuan",
  "putrajaya",
] as const;
export const MalaysiaStateSchema = z.enum(MALAYSIA_STATES);
export type MalaysiaState = z.infer<typeof MalaysiaStateSchema>;

/** Employment status used both as an interview slot and inside eligibility rules. */
export const EMPLOYMENT_STATUSES = [
  "employed",
  "underemployed",
  "unemployed",
  "student",
  "self_employed",
] as const;
export const EmploymentStatusSchema = z.enum(EMPLOYMENT_STATUSES);
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

/** Impact interest from the interview. "none" adds no SDG ranking bonus. */
export const IMPACT_INTERESTS = [
  "environment",
  "education",
  "health",
  "community",
  "none",
] as const;
export const ImpactInterestSchema = z.enum(IMPACT_INTERESTS);
export type ImpactInterest = z.infer<typeof ImpactInterestSchema>;

/** Interview asks at most this many questions, then stops (section 03). */
export const MAX_INTERVIEW_TURNS = 5;

/** Embedding width for occupations.embedding and skills.embedding (vector(768)). */
export const EMBEDDING_DIMENSIONS = 768;

/** Gemini embedding model. Calls must set outputDimensionality: 768 to match vector(768). */
export const EMBEDDING_MODEL = "gemini-embedding-001";

/** Task shares on a complete Slots object must add up to 1 within this tolerance. */
const TASK_SHARE_TOLERANCE = 0.02;

/** Source chip: dataset name, release date, link, and the as_of date of the figure. */
export const SourceSchema = z
  .strictObject({
    dataset: z.string().min(1),
    releaseDate: IsoDateSchema,
    url: z.url(),
    asOf: IsoDateSchema,
  })
  .describe("Dated source chip for a score, signal, or SDG claim.");
export type Source = z.infer<typeof SourceSchema>;

/**
 * What an SDG link is about. A link attaches to one occupation or one skill,
 * because every role and every skill needs at least one target.
 */
export const SdgSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("occupation"),
    occupationId: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal("skill"),
    skillId: z.string().min(1),
  }),
]);
export type SdgSubject = z.infer<typeof SdgSubjectSchema>;

/**
 * One SDG claim at target level. `kind` is role (the work itself) or transition
 * (the move into the work). `subject.kind` is a different axis: occupation or skill.
 */
export const SdgLinkSchema = z
  .strictObject({
    subject: SdgSubjectSchema,
    target: SdgTargetIdSchema,
    kind: z.enum(["role", "transition"]),
    tier: z.enum(["direct", "supporting", "inferred"]),
    confidence: UnitScoreSchema,
    reason: z.string().min(1),
    source: SourceSchema,
  })
  .describe("Target-level SDG link with a tier, a reason, and a dated source.");
export type SdgLink = z.infer<typeof SdgLinkSchema>;

/** One role read off a CV. `tasks` here are descriptions, not time shares. */
export const ParsedCvRoleSchema = z.strictObject({
  title: z.string().min(1),
  years: z.number().nonnegative(),
  tasks: z.array(z.string().min(1)),
});
export type ParsedCvRole = z.infer<typeof ParsedCvRoleSchema>;

/** One education line read off a CV. Level and field stay free text. */
export const ParsedCvEducationSchema = z.strictObject({
  level: z.string().min(1),
  field: z.string().min(1),
});
export type ParsedCvEducation = z.infer<typeof ParsedCvEducationSchema>;

/** Gemini's CV parse. Name is optional; there is no stored file path. */
export const ParsedCVSchema = z
  .strictObject({
    name: z.string().min(1).optional(),
    roles: z.array(ParsedCvRoleSchema),
    skills: z.array(z.string().min(1)),
    education: z.array(ParsedCvEducationSchema),
    languages: z.array(z.string().min(1)),
  })
  .describe("CV parse: roles, skills, education, and languages. No cv_path.");
export type ParsedCV = z.infer<typeof ParsedCVSchema>;

/** One current task and the fraction of the week it takes (0–1, not 0–100). */
export const TaskShareSchema = z.strictObject({
  text: z.string().min(1),
  share: UnitScoreSchema,
});
export type TaskShare = z.infer<typeof TaskShareSchema>;

const slotsObject = z.strictObject({
  tasks: z.array(TaskShareSchema).min(1),
  tools: z.array(z.string().min(1)),
  ai_usage: AiUsageSchema,
  hours_per_week: z.number().min(0).max(168),
  budget: z.number().nonnegative(),
  languages: z.array(LanguageCodeSchema).min(1),
  age_band: AgeBandSchema,
  state: MalaysiaStateSchema,
  employment_status: EmploymentStatusSchema,
  perkeso_contributor: z.boolean(),
  impact_interest: ImpactInterestSchema,
});

/**
 * Interview slots still being filled. Omitted keys are unknown.
 * Unknown eligibility slots are shown as "check eligibility", not guessed.
 */
export const PartialSlotsSchema = slotsObject.partial();
export type PartialSlots = z.infer<typeof PartialSlotsSchema>;

/**
 * Complete interview slots from section 03. Keys stay snake_case, matching the
 * slot table. `budget` is MYR the user can spend (0 means none). Task shares
 * must sum to 1. `languages` is one or more of en, ms, zh (multi-select).
 * `perkeso_contributor` is only true or false here; a missing
 * answer lives on PartialSlots, not as null.
 */
export const SlotsSchema = slotsObject
  .superRefine((slots, ctx) => {
    const sum = slots.tasks.reduce((total, task) => total + task.share, 0);
    if (Math.abs(sum - 1) > TASK_SHARE_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        message: "Task shares must sum to 1 (the whole week), within 0.02.",
        path: ["tasks"],
      });
    }
  })
  .describe("Filled interview slots. Task shares are fractions of the week.");
export type Slots = z.infer<typeof SlotsSchema>;

/**
 * One slot-filling turn. `done` means the interview stopped (slots complete,
 * or MAX_INTERVIEW_TURNS reached). It does not promise every slot is present.
 */
export const InterviewTurnSchema = z
  .strictObject({
    question: z.string(),
    chips: z.array(z.string().min(1)),
    filled: PartialSlotsSchema,
    done: z.boolean(),
  })
  .describe("One interview turn: question, chips, slots filled so far, and done.");
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

/** One missing essential skill on a role card (top 5 by importance). */
export const GapSkillSchema = z
  .strictObject({
    skillId: z.string().min(1),
    label: z.string().min(1),
    importance: z.number().nonnegative(),
  })
  .describe("A missing skill: ESCO id, label, and momentum-adjusted importance.");
export type GapSkill = z.infer<typeof GapSkillSchema>;

/** Ranking score R for one scenario. Not clamped; the scoring formula owns the scale. */
export const ScenarioScoresSchema = z.strictObject({
  co: z.number(),
  dis: z.number(),
  sup: z.number(),
});
export type ScenarioScores = z.infer<typeof ScenarioScoresSchema>;

/**
 * One recommended role. `signalsAsOf` is the signal snapshot the fit ranking
 * was computed from, so the UI can tell "today" from "30 days ago".
 * `sdg` is 1–3 links, all about this occupation.
 */
export const RoleResultSchema = z
  .strictObject({
    occupationId: z.string().min(1),
    title: z.string().min(1),
    fit: UnitScoreSchema,
    exposure: UnitScoreSchema,
    augmentation: UnitScoreSchema,
    byScenario: ScenarioScoresSchema,
    robust: z.boolean(),
    gap: z.array(GapSkillSchema).max(5),
    sdg: z.array(SdgLinkSchema).min(1).max(3),
    sources: z.array(SourceSchema).min(1),
    signalsAsOf: IsoDateSchema,
    explanation: z.string().min(1).optional(),
  })
  .superRefine((role, ctx) => {
    role.sdg.forEach((link, index) => {
      if (link.subject.kind !== "occupation" || link.subject.occupationId !== role.occupationId) {
        ctx.addIssue({
          code: "custom",
          message: "Each SDG link on a role card must target that occupation.",
          path: ["sdg", index, "subject"],
        });
      }
    });
  })
  .describe("Role card: fit, exposure, augmentation, scenarios, gap, SDGs, sources.");
export type RoleResult = z.infer<typeof RoleResultSchema>;

/**
 * One skill reading inside a signal snapshot. `value` may be negative
 * (momentum falls). The snapshot, not the row, carries asOf.
 */
export const SignalReadingSchema = z
  .strictObject({
    skillId: z.string().min(1),
    source: z.literal("arXiv"),
    metric: z.string().min(1),
    value: z.number(),
    windowStart: IsoDateSchema,
    windowEnd: IsoDateSchema,
    url: z.url(),
  })
  .superRefine((reading, ctx) => {
    if (reading.windowStart > reading.windowEnd) {
      ctx.addIssue({
        code: "custom",
        message: "windowStart cannot be after windowEnd.",
        path: ["windowStart"],
      });
    }
  })
  .describe("One dated skill signal: metric, value, and the window it covers.");
export type SignalReading = z.infer<typeof SignalReadingSchema>;

/**
 * Signals that share one as_of date. The UI compares two snapshots
 * (for example 30 days ago and today) and re-ranks role cards.
 */
export const SignalSnapshotSchema = z
  .strictObject({
    asOf: IsoDateSchema,
    signals: z.array(SignalReadingSchema),
  })
  .describe("Signal layer snapshot. asOf is the date the UI compares.");
export type SignalSnapshot = z.infer<typeof SignalSnapshotSchema>;

/** Exposure and augmentation of the user's current work, with source chips. */
export const CurrentWorkScoresSchema = z.strictObject({
  exposure: UnitScoreSchema,
  augmentation: UnitScoreSchema,
  sources: z.array(SourceSchema).min(1),
});
export type CurrentWorkScores = z.infer<typeof CurrentWorkScoresSchema>;

/**
 * /api/analyze response. `signalsAsOf` names the snapshot every role was
 * ranked from. Current-work scores are separate from the role cards.
 */
export const AnalyzeResponseSchema = z
  .strictObject({
    signalsAsOf: IsoDateSchema,
    currentWork: CurrentWorkScoresSchema,
    roles: z.array(RoleResultSchema).min(1),
  })
  .superRefine((response, ctx) => {
    response.roles.forEach((role, index) => {
      if (role.signalsAsOf !== response.signalsAsOf) {
        ctx.addIssue({
          code: "custom",
          message: "Each role must use the response's signal snapshot date.",
          path: ["roles", index, "signalsAsOf"],
        });
      }
    });
  })
  .describe("Analyze response: current-work scores, role cards, and signalsAsOf.");
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

/**
 * Programme eligibility JSON from section 07. Keys stay snake_case because this
 * object is stored as written. Null means that rule is not applied. "any" and
 * "all" must appear alone.
 */
export const ProgrammeEligibilitySchema = z
  .strictObject({
    age_min: z.int().nonnegative().nullable(),
    age_max: z.int().nonnegative().nullable(),
    citizen: z.boolean().nullable(),
    employment: z.array(z.union([EmploymentStatusSchema, z.literal("any")])).min(1),
    perkeso_contributor: z.boolean().nullable(),
    states: z.array(z.union([MalaysiaStateSchema, z.literal("all")])).min(1),
  })
  .superRefine((rules, ctx) => {
    if (rules.age_min != null && rules.age_max != null && rules.age_min > rules.age_max) {
      ctx.addIssue({
        code: "custom",
        message: "age_min cannot be greater than age_max.",
        path: ["age_min"],
      });
    }
    if (rules.employment.includes("any") && rules.employment.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: '"any" cannot be combined with other employment statuses.',
        path: ["employment"],
      });
    }
    if (rules.states.includes("all") && rules.states.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: '"all" cannot be combined with specific states.',
        path: ["states"],
      });
    }
  })
  .describe("Eligibility rules stored on a programme. Null means the rule is off.");
export type ProgrammeEligibility = z.infer<typeof ProgrammeEligibilitySchema>;

/**
 * A curated course. skillIds are ESCO ids. costType uses the shared cost union.
 * `languages` lists every language the course is offered in (at least one).
 */
export const CourseSchema = z
  .strictObject({
    id: z.string().min(1),
    title: z.string().min(1),
    provider: z.string().min(1),
    url: z.url(),
    languages: z.array(LanguageCodeSchema).min(1),
    hours: z.number().positive(),
    costType: CostTypeSchema,
    certificate: z.boolean(),
    skillIds: z.array(z.string().min(1)),
    lastChecked: IsoDateSchema,
  })
  .describe("Curated course the pathway may cite by id.");
export type Course = z.infer<typeof CourseSchema>;

/**
 * A curated government programme. costType is included so pathway ordering
 * can place programmes on the same free → paid scale as courses.
 */
export const ProgrammeSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    agency: z.string().min(1),
    url: z.url(),
    benefits: z.string().min(1),
    eligibility: ProgrammeEligibilitySchema,
    costType: CostTypeSchema,
    deadline: IsoDateSchema.nullable(),
    lastChecked: IsoDateSchema,
  })
  .describe("Government programme with eligibility JSON and a last-checked date.");
export type Programme = z.infer<typeof ProgrammeSchema>;

/**
 * One ID-only pathway step. kind "program" matches the frozen contract
 * (the catalogue type is Programme). Weeks are 1-based and weekEnd >= weekStart.
 */
export const PlanStepSchema = z
  .strictObject({
    itemId: z.string().min(1),
    kind: z.enum(["course", "program"]),
    weekStart: z.int().positive(),
    weekEnd: z.int().positive(),
    closesSkillIds: z.array(z.string().min(1)),
    sdgTarget: SdgTargetIdSchema.optional(),
    why: z.string().min(1),
  })
  .superRefine((step, ctx) => {
    if (step.weekEnd < step.weekStart) {
      ctx.addIssue({
        code: "custom",
        message: "weekEnd cannot be before weekStart.",
        path: ["weekEnd"],
      });
    }
  })
  .describe("One pathway step that cites a course or programme id, never a URL.");
export type PlanStep = z.infer<typeof PlanStepSchema>;

/** Pathway for one chosen occupation. Steps are ID-only; no profile id. */
export const PathwayPlanSchema = z
  .strictObject({
    occupationId: z.string().min(1),
    steps: z.array(PlanStepSchema),
  })
  .describe("Ordered pathway for one occupation. The model cites ids only.");
export type PathwayPlan = z.infer<typeof PathwayPlanSchema>;
