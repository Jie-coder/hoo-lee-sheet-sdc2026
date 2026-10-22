// Profile + catalogue -> ranked future roles. Pure and deterministic: no
// network, no LLM, no clock. This is the "trend signal -> role matching"
// pipeline the brief asks to see working:
//
//   ESCO essential skills per role  ┐
//   arXiv momentum per skill        ├─> scoreRoles (src/lib/scoring.ts) -> RoleResult[]
//   ILO exposure per role           │
//   SDG targets per role            ┘
//
// Every number on a role card comes from a dated row in data/*.csv.
import {
  RoleResultSchema,
  SCENARIO_IDS,
  type ImpactInterest,
  type IsoDate,
  type RoleResult,
  type ScenarioId,
  type ScenarioScores,
  type SdgLink,
  type Source,
} from "@/types/contracts";
import { SOURCE_NAMES, type Catalogue, type CatalogueOccupation } from "@/lib/catalogue";
import {
  SCORING_PARAMS,
  compareId,
  scenarioDemand,
  scoreRoles,
  sdgInterestMatches,
  skillImportance,
  type CandidateRole,
  type EssentialSkillInput,
} from "@/lib/scoring";
/** Neutral skill weight, the same value the importer writes (DEFAULT_BASE_IMPORTANCE in scripts/lib/apply.ts). */
const BASE_IMPORTANCE = 1;

/** One skill the user has: an ESCO id, and 1 (from the CV) or 0.5 (added by hand). */
export type ProfileSkill = { skillId: string; level: number };

export type AnalyzeInput = {
  skills: readonly ProfileSkill[];
  /** The user's current job in occupations.csv; it is never recommended back to them. */
  currentOccupationId: string | null;
  impactInterest: ImpactInterest;
  /** Which arXiv snapshot to rank with: today's, or the one ~30 days earlier. Defaults to today. */
  signalDate?: SignalDate;
};

/** "prior" is the snapshot in data/keywords_prior.csv, about 30 days before "today". */
export const SIGNAL_DATES = ["today", "prior"] as const;
export type SignalDate = (typeof SIGNAL_DATES)[number];

export type RoleStatusTone = "robust" | "shift" | "interest";

/** What the card shows next to each number, so the score explains itself. */
export type RoleBreakdown = {
  /** Essential skills the user has exactly (same ESCO skill). */
  matchedSkills: number;
  /** Essential skills in the same ESCO skill group as one of the user's: quarter credit, capped at relatedSkillCap (4) per role. */
  relatedSkills: number;
  essentialSkills: number;
  demand: ScenarioScores;
  exposureGroupEstimate: boolean;
  /** Essential skills with an arXiv signal, and the keywords behind them. */
  trendSkills: { label: string; momentum: number; keywords: string[] }[];
  interestMatch: boolean;
  status: { label: string; tone: RoleStatusTone };
  /** ESCO group id of each gap skill, for "related course" suggestions on the pathway. */
  gapGroups: Record<string, string>;
};

export type AnalyzeResult = {
  signalDate: SignalDate;
  signalsAsOf: IsoDate;
  /** Both snapshot dates, so the page can label the toggle. prior is null when it wasn't collected. */
  signalDates: { today: IsoDate; prior: IsoDate | null };
  currentWork: { occupationId: string; title: string; exposure: number; groupEstimate: boolean; sources: Source[] } | null;
  roles: RoleResult[];
  breakdown: Record<string, RoleBreakdown>;
  /** SDG target id -> short label, for badges. */
  targetLabels: Record<string, string>;
  /** ESCO group id -> label, for every group named in a breakdown's gapGroups. */
  groupLabels: Record<string, string>;
};

const SCENARIO_SHORT: Record<ScenarioId, string> = { co: "Co-Pilot", dis: "Displacement", sup: "Supercharged" };

const INTEREST_LABEL: Record<ImpactInterest, string> = {
  environment: "environment",
  education: "education",
  health: "health",
  community: "community",
  none: "",
};

function source(catalogue: Catalogue, name: string, asOf: IsoDate): Source {
  const row = catalogue.sources[name];
  if (!row) throw new Error(`catalogue has no source named "${name}"`);
  return { dataset: row.name, releaseDate: row.lastUpdated, url: row.url, asOf };
}

function sdgLinks(occupation: CatalogueOccupation): SdgLink[] {
  return occupation.sdg.map((sdg) => ({
    subject: { kind: "occupation", occupationId: occupation.id },
    target: sdg.target,
    kind: "role",
    tier: sdg.tier,
    // Not shown: the tier carries the meaning. Fixed per tier, never a measured probability.
    confidence: sdg.tier === "direct" ? 1 : 0.5,
    reason: sdg.reason,
    source: { dataset: "UN SDG targets", releaseDate: sdg.checkedOn, url: sdg.sourceUrl, asOf: sdg.checkedOn },
  }));
}

function statusFor(
  role: { robust: boolean; byScenario: ScenarioScores; occupationId: string },
  topByScenario: Record<ScenarioId, Set<string>>,
  interestMatch: boolean,
  interest: ImpactInterest,
): RoleBreakdown["status"] {
  if (role.robust) return { label: "Robust in all 3 futures", tone: "robust" };
  if (interestMatch) return { label: `Matches your interest: ${INTEREST_LABEL[interest]}`, tone: "interest" };
  const inTop = SCENARIO_IDS.filter((scenario) => topByScenario[scenario].has(role.occupationId));
  return { label: `Top 3 in ${inTop.map((scenario) => SCENARIO_SHORT[scenario]).join(" and ")} only`, tone: "shift" };
}

function topIds(roles: readonly RoleResult[], scenario: ScenarioId): Set<string> {
  const ordered = [...roles].sort(
    (a, b) => b.byScenario[scenario] - a.byScenario[scenario] || (a.occupationId < b.occupationId ? -1 : 1),
  );
  return new Set(ordered.slice(0, SCORING_PARAMS.topN).map((role) => role.occupationId));
}

/** Credit for an essential skill in the same ESCO group as a user skill, times that skill's level. */
export const RELATED_SKILL_CREDIT = SCORING_PARAMS.relatedSkillCredit;

export function analyzeProfile(catalogue: Catalogue, input: AnalyzeInput): AnalyzeResult {
  // The prior snapshot falls back to today's when it wasn't collected.
  const usePrior = input.signalDate === "prior" && catalogue.priorSignals != null && catalogue.priorSignalsAsOf != null;
  const signalDate: SignalDate = usePrior ? "prior" : "today";
  const signals = usePrior ? (catalogue.priorSignals as Catalogue["signals"]) : catalogue.signals;
  const signalsAsOf = usePrior ? (catalogue.priorSignalsAsOf as IsoDate) : catalogue.signalsAsOf;

  const userLevel = new Map<string, number>();
  const groupLevel = new Map<string, number>();
  for (const skill of input.skills) {
    userLevel.set(skill.skillId, Math.max(userLevel.get(skill.skillId) ?? 0, skill.level));
    const group = catalogue.skillGroups[skill.skillId];
    if (group) groupLevel.set(group, Math.max(groupLevel.get(group) ?? 0, skill.level));
  }
  /**
   * h_s for every essential skill of one role: the user's level for the
   * exact skill, else related credit for a same-group skill, else 0.
   *
   * Related credit is only given to the relatedSkillCap (4) related skills
   * with the highest adjusted importance imp_s (ties by skillId ascending).
   * Any related skill beyond that falls back to missing. Without a cap, a
   * role with many essential skills and a user with a few broadly-connected
   * skills could rack up related credit on every one of them — the cap
   * keeps it a small nudge, not a second way to match. See the header
   * comment in scoring.ts for the full reasoning.
   */
  const levelsFor = (skillIds: readonly string[]): Map<string, number> => {
    const levels = new Map<string, number>();
    const related: { skillId: string; credit: number; imp: number }[] = [];
    for (const skillId of skillIds) {
      const exact = userLevel.get(skillId);
      if (exact != null) {
        levels.set(skillId, exact);
        continue;
      }
      const group = catalogue.skillGroups[skillId];
      const groupLvl = group ? groupLevel.get(group) : undefined;
      if (groupLvl == null) {
        levels.set(skillId, SCORING_PARAMS.skillLevel.missing);
        continue;
      }
      related.push({
        skillId,
        credit: SCORING_PARAMS.relatedSkillCredit * groupLvl,
        imp: skillImportance(BASE_IMPORTANCE, signals[skillId]?.momentum ?? 0),
      });
    }
    related.sort((a, b) => b.imp - a.imp || compareId(a.skillId, b.skillId));
    related.forEach((item, index) => {
      levels.set(
        item.skillId,
        index < SCORING_PARAMS.relatedSkillCap ? item.credit : SCORING_PARAMS.skillLevel.missing,
      );
    });
    return levels;
  };
  const teachable = new Set(catalogue.courses.flatMap((course) => course.skillIds));

  const scorable = catalogue.occupations.filter(
    (occupation) => occupation.id !== input.currentOccupationId && occupation.exposure && occupation.essentialSkillIds.length > 0,
  );

  const levelsByOccupation = new Map(
    scorable.map((occupation) => [occupation.id, levelsFor(occupation.essentialSkillIds)] as const),
  );

  const candidates: CandidateRole[] = scorable.map((occupation) => {
    const levels = levelsByOccupation.get(occupation.id)!;
    return {
      occupationId: occupation.id,
      title: occupation.title,
      cluster: occupation.cluster,
      // One task covering the whole week, at the occupation's published exposure.
      // Augmentation is not scored yet (no task-level data), so it is 0 and never shown.
      tasks: [{ share: 1, automation: occupation.exposure?.value ?? 0, augmentation: 0 }],
      essentialSkills: occupation.essentialSkillIds.map(
        (skillId): EssentialSkillInput => ({
          skillId,
          label: catalogue.skills[skillId] ?? skillId,
          baseImportance: BASE_IMPORTANCE,
          momentum: signals[skillId]?.momentum ?? 0,
          level: levels.get(skillId) ?? SCORING_PARAMS.skillLevel.missing,
          teachable: teachable.has(skillId),
        }),
      ),
      sdgLinks: occupation.sdg.map((sdg) => ({ target: sdg.target, tier: sdg.tier })),
    };
  });

  const scored = scoreRoles(candidates, input.impactInterest);
  const byId = new Map(scorable.map((occupation) => [occupation.id, occupation]));
  const asOf = signalsAsOf;

  const roles: RoleResult[] = scored.map((role) => {
    const occupation = byId.get(role.occupationId) as CatalogueOccupation;
    const exposure = occupation.exposure as NonNullable<CatalogueOccupation["exposure"]>;
    const sources = [
      source(catalogue, SOURCE_NAMES.skills, asOf),
      source(catalogue, exposure.sourceName, exposure.asOf),
      source(catalogue, SOURCE_NAMES.trend, asOf),
    ];
    return RoleResultSchema.parse({
      occupationId: role.occupationId,
      title: role.title,
      fit: role.fit,
      exposure: role.exposure,
      byScenario: role.byScenario,
      robust: role.robust,
      gap: role.gap,
      sdg: sdgLinks(occupation),
      sources,
      signalsAsOf: asOf,
    });
  });

  const topByScenario = Object.fromEntries(
    SCENARIO_IDS.map((scenario) => [scenario, topIds(roles, scenario)]),
  ) as Record<ScenarioId, Set<string>>;

  const breakdown: Record<string, RoleBreakdown> = {};
  for (const role of roles) {
    const occupation = byId.get(role.occupationId) as CatalogueOccupation;
    const interestMatch = sdgInterestMatches(
      occupation.sdg.map((sdg) => ({ target: sdg.target, tier: sdg.tier })),
      input.impactInterest,
    );
    const levels = levelsByOccupation.get(role.occupationId)!;
    breakdown[role.occupationId] = {
      matchedSkills: occupation.essentialSkillIds.filter((id) => userLevel.has(id)).length,
      // Capped the same way as fit: at most relatedSkillCap (4) per role.
      relatedSkills: occupation.essentialSkillIds.filter(
        (id) => !userLevel.has(id) && (levels.get(id) ?? 0) > 0,
      ).length,
      essentialSkills: occupation.essentialSkillIds.length,
      demand: Object.fromEntries(
        SCENARIO_IDS.map((scenario) => [scenario, scenarioDemand(occupation.cluster, scenario)]),
      ) as ScenarioScores,
      exposureGroupEstimate: occupation.exposure?.groupEstimate ?? false,
      trendSkills: occupation.essentialSkillIds
        .filter((id) => signals[id])
        .map((id) => ({
          label: catalogue.skills[id] ?? id,
          momentum: signals[id].momentum,
          keywords: signals[id].keywords,
        })),
      interestMatch,
      status: statusFor(role, topByScenario, interestMatch, input.impactInterest),
      gapGroups: Object.fromEntries(
        role.gap.flatMap((skill) =>
          catalogue.skillGroups[skill.skillId] ? [[skill.skillId, catalogue.skillGroups[skill.skillId]]] : [],
        ),
      ),
    };
  }

  const current = input.currentOccupationId
    ? catalogue.occupations.find((occupation) => occupation.id === input.currentOccupationId)
    : undefined;

  const targetLabels = Object.fromEntries(
    catalogue.occupations.flatMap((occupation) => occupation.sdg.map((sdg) => [sdg.target, sdg.label])),
  );

  return {
    signalDate,
    signalsAsOf: asOf,
    signalDates: { today: catalogue.signalsAsOf, prior: catalogue.priorSignalsAsOf },
    currentWork:
      current?.exposure != null
        ? {
            occupationId: current.id,
            title: current.title,
            exposure: current.exposure.value,
            groupEstimate: current.exposure.groupEstimate,
            sources: [source(catalogue, current.exposure.sourceName, current.exposure.asOf)],
          }
        : null,
    roles,
    breakdown,
    targetLabels,
    groupLabels: Object.fromEntries(
      Object.values(breakdown)
        .flatMap((item) => Object.values(item.gapGroups))
        .map((groupId) => [groupId, catalogue.groupLabels[groupId] ?? groupId]),
    ),
  };
}
