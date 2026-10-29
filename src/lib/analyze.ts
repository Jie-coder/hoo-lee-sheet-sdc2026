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
import { displayFit,
  SCORING_PARAMS,
  compareId,
  NON_RECOMMENDED_CLUSTERS,
  roleFitScore,
  roleMomentum,
  scenarioDemand,
  scenarioRank,
  scoreRoles,
  sdgInterestMatches,
  skillImportance,
  topRoleIdsForScenario,
  type CandidateRole,
  type EssentialSkillInput,
} from "@/lib/scoring";
import {
  calibrateFit,
  fitRank,
  scoreBreakdown,
  type ScoreBreakdown,
  type WhatIfItem,
} from "./score-breakdown";
import { rankRoles } from "./rank-roles";
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
  /** Adoption level for the role trend boost in rankScore. Defaults to SCORING_PARAMS.defaultAdoption. */
  adoption?: number;
};

/** "prior" is the snapshot in data/keywords_prior.csv, about 30 days before "today". */
export const SIGNAL_DATES = ["today", "prior"] as const;
export type SignalDate = (typeof SIGNAL_DATES)[number];

export type RoleStatusTone = "robust" | "shift" | "interest";

/** What the card shows next to each number, so the score explains itself. */
export type RoleBreakdown = {
  /** Essential skills the user has exactly (same ESCO skill). */
  matchedSkills: number;
  /** Essential skills in the same ESCO skill group as one of the user's: half credit, capped at relatedSkillCap (10) per role — only the 10 most important count. */
  relatedSkills: number;
  /** The same related skills by label (ESCO), in essential-skill order: what earned half credit. */
  relatedSkillLabels: string[];
  essentialSkills: number;
  demand: ScenarioScores;
  exposureGroupEstimate: boolean;
  /** Essential skills with an arXiv signal, and the keywords behind them. */
  trendSkills: { label: string; momentum: number; keywords: string[] }[];
  interestMatch: boolean;
  /** Raw skill fit (same as role.fit). Drives ranking and the Transition route label. */
  skillFit: number;
  /** Displayed Fit: skillFit + INTEREST_FIT_BONUS (max 1) when the role matches the chosen interest, else skillFit. */
  displayFit: number;
  status: { label: string; tone: RoleStatusTone };
  /** ESCO group id of each gap skill, for "related course" suggestions on the pathway. */
  gapGroups: Record<string, string>;
  score: Record<ScenarioId, ScoreBreakdown>;
  /** What-if items per scenario; the drawer shows the active scenario's list. */
  whatIf: Record<ScenarioId, WhatIfItem[]>;
  calibratedFit: number;
  fitRank: { rank: number; total: number };
  /** 1-based position among all scorable candidates, by the scenario total with the rankRoles tie-break. */
  totalRank: Record<ScenarioId, number>;
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

/** Half credit for an essential skill in the same ESCO group as a user skill, times that skill's level. */
export const RELATED_SKILL_CREDIT = SCORING_PARAMS.relatedSkillCredit;

type AnalyzeInternals = { computeWhatIf?: boolean };

type CandidateSummary = {
  fit: number;
  byScenario: ScenarioScores;
  /** Raw-fit scenario totals used for role-list inclusion (no trend boost). */
  selectionByScenario: ScenarioScores;
};

type AnalyzeCoreResult = {
  result: AnalyzeResult;
  candidatesById: Record<string, CandidateSummary>;
};

function emptyWhatIf(): Record<ScenarioId, WhatIfItem[]> {
  return { co: [], dis: [], sup: [] };
}

function analyzeProfileCore(
  catalogue: Catalogue,
  input: AnalyzeInput,
  internals?: AnalyzeInternals,
): AnalyzeCoreResult {
  const computeWhatIf = internals?.computeWhatIf ?? true;
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
   * Related credit (half credit) is only given to the relatedSkillCap (10)
   * related skills with the highest adjusted importance imp_s (the 10 most
   * important skills of the role; ties by skillId ascending). Any related
   * skill beyond that falls back to missing. Without a cap, a role with
   * many essential skills and a user with a few broadly-connected skills
   * could rack up related credit on every one of them — the cap keeps it a
   * small nudge, not a second way to match, so a broad CV can't pad its fit
   * score with adjacent skills. See the header comment in scoring.ts for
   * the full reasoning.
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
    (occupation) =>
      occupation.id !== input.currentOccupationId &&
      !NON_RECOMMENDED_CLUSTERS.has(occupation.cluster) &&
      occupation.exposure &&
      occupation.essentialSkillIds.length > 0,
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
      roleMomentum: roleMomentum(occupation.essentialSkillIds, signals),
    };
  });

  const scored = scoreRoles(candidates, input.impactInterest, { adoption: input.adoption });
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

  const allFits = candidates.map((candidate) => ({
    occupationId: candidate.occupationId,
    fit: roleFitScore(
      candidate.essentialSkills.map((skill) => ({
        importance: skillImportance(skill.baseImportance, skill.momentum),
        level: skill.level,
      })),
    ),
  }));

  // Score every scorable candidate for every scenario, so totalRank is a
  // position among all of them (not just the roles that made a top 3).
  const allScores = new Map(
    candidates.map((candidate) => [
      candidate.occupationId,
      Object.fromEntries(
        SCENARIO_IDS.map((scenario) => [
          scenario,
          scoreBreakdown(candidate, {
            scenario,
            impactInterest: input.impactInterest,
            adoption: input.adoption,
          }),
        ]),
      ) as Record<ScenarioId, ScoreBreakdown>,
    ]),
  );
  const candidatesById: Record<string, CandidateSummary> = Object.fromEntries(
    candidates.map((candidate) => {
      const scores = allScores.get(candidate.occupationId)!;
      return [
        candidate.occupationId,
        {
          fit: scores.co.fit,
          byScenario: Object.fromEntries(
            SCENARIO_IDS.map((scenario) => [scenario, scores[scenario].total]),
          ) as ScenarioScores,
          selectionByScenario: Object.fromEntries(
            SCENARIO_IDS.map((scenario) => [
              scenario,
              scenarioRank({
                fit: scores[scenario].fit,
                demand: scores[scenario].demand,
                exposure: scores[scenario].exposure,
                theta: scores[scenario].theta,
                sdgMatch: scores[scenario].sdgMatch === 1,
              }),
            ]),
          ) as ScenarioScores,
        },
      ];
    }),
  );
  const topByScenario = Object.fromEntries(
    SCENARIO_IDS.map((scenario) => [
      scenario,
      topRoleIdsForScenario(
        roles.map((role) => ({
          occupationId: role.occupationId,
          fit: role.fit,
          byScenario: candidatesById[role.occupationId].selectionByScenario,
          sdgMatch: sdgInterestMatches(
            (byId.get(role.occupationId) as CatalogueOccupation).sdg.map((sdg) => ({
              target: sdg.target,
              tier: sdg.tier,
            })),
            input.impactInterest,
          ),
        })),
        scenario,
      ),
    ]),
  ) as Record<ScenarioId, Set<string>>;
  const allRankables = candidates.map((candidate) => ({
    occupationId: candidate.occupationId,
    ...candidatesById[candidate.occupationId],
  }));
  const totalRanks: Record<string, Record<ScenarioId, number>> = {};
  for (const scenario of SCENARIO_IDS) {
    // Same strict comparator as the card order, over every scorable candidate.
    rankRoles(allRankables, scenario).forEach((item, index) => {
      totalRanks[item.occupationId] ??= {} as Record<ScenarioId, number>;
      totalRanks[item.occupationId][scenario] = index + 1;
    });
  }

  // What-if = a full re-run with one missing essential skill at full level.
  // The nested run skips what-if itself (computeWhatIf false), and results are
  // cached per skill because the nested profile is independent of the role.
  const whatIfByRole = new Map<string, Record<ScenarioId, WhatIfItem[]>>();
  if (computeWhatIf) {
    const nestedCache = new Map<string, AnalyzeCoreResult>();
    for (const role of roles) {
      const candidate = candidates.find((item) => item.occupationId === role.occupationId) as CandidateRole;
      const missing = candidate.essentialSkills.filter(
        (skill) => skill.level === SCORING_PARAMS.skillLevel.missing,
      );
      const byScenario = Object.fromEntries(
        SCENARIO_IDS.map((scenario) => [
          scenario,
          missing
            .flatMap((skill): WhatIfItem[] => {
              let nested = nestedCache.get(skill.skillId);
              if (!nested) {
                nested = analyzeProfileCore(
                  catalogue,
                  {
                    ...input,
                    skills: [
                      ...input.skills,
                      { skillId: skill.skillId, level: SCORING_PARAMS.skillLevel.full },
                    ],
                  },
                  { computeWhatIf: false },
                );
                nestedCache.set(skill.skillId, nested);
              }
              const after = nested.candidatesById[role.occupationId];
              if (!after) return [];
              return [
                {
                  skillId: skill.skillId,
                  label: skill.label,
                  fitBefore: role.fit,
                  fitAfter: after.fit,
                  totalBefore: role.byScenario[scenario],
                  totalAfter: after.byScenario[scenario],
                  deltaPoints: (after.byScenario[scenario] - role.byScenario[scenario]) * 100,
                },
              ];
            })
            .sort((a, b) => b.deltaPoints - a.deltaPoints || compareId(a.skillId, b.skillId))
            .slice(0, 5),
        ]),
      ) as Record<ScenarioId, WhatIfItem[]>;
      whatIfByRole.set(role.occupationId, byScenario);
    }
  }

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
      // Capped the same way as fit: at most relatedSkillCap (10) per role.
      relatedSkills: occupation.essentialSkillIds.filter(
        (id) => !userLevel.has(id) && (levels.get(id) ?? 0) > 0,
      ).length,
      relatedSkillLabels: occupation.essentialSkillIds
        .filter((id) => !userLevel.has(id) && (levels.get(id) ?? 0) > 0)
        .map((id) => catalogue.skills[id] ?? id),
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
      skillFit: role.fit,
      displayFit: displayFit(role.fit, interestMatch),
      status: statusFor(role, topByScenario, interestMatch, input.impactInterest),
      gapGroups: Object.fromEntries(
        role.gap.flatMap((skill) =>
          catalogue.skillGroups[skill.skillId] ? [[skill.skillId, catalogue.skillGroups[skill.skillId]]] : [],
        ),
      ),
      score: allScores.get(role.occupationId)!,
      whatIf: whatIfByRole.get(role.occupationId) ?? emptyWhatIf(),
      calibratedFit: calibrateFit(role.fit),
      fitRank: fitRank(allFits, role.occupationId),
      totalRank: totalRanks[role.occupationId],
    };
  }

  const current = input.currentOccupationId
    ? catalogue.occupations.find((occupation) => occupation.id === input.currentOccupationId)
    : undefined;

  const targetLabels = Object.fromEntries(
    catalogue.occupations.flatMap((occupation) => occupation.sdg.map((sdg) => [sdg.target, sdg.label])),
  );

  const result: AnalyzeResult = {
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
  return { result, candidatesById };
}

export function analyzeProfile(catalogue: Catalogue, input: AnalyzeInput): AnalyzeResult {
  return analyzeProfileCore(catalogue, input).result;
}
