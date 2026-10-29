import {
  SCORING_PARAMS,
  exposureScore,
  rankScore,
  roleFitScore,
  roleMomentum,
  scenarioDemand,
  scenarioRank,
  sdgInterestMatches,
  skillImportance,
  type CandidateRole,
} from "./scoring";
import type { ImpactInterest, ScenarioId } from "../types/contracts";

export type MomentumSignals = Readonly<Record<string, { momentum: number }>>;

export type BreakdownOptions = {
  scenario: ScenarioId;
  impactInterest: ImpactInterest;
  signals?: MomentumSignals;
  momentumMultiplier?: number;
  adoption?: number;
};

type SkillBreakdown = {
  skillId: string;
  label: string;
  level: number;
  baseImportance: number;
  momentum: number;
  importance: number;
  momentumContribution: number;
  fitPoints: number;
};

export type ScoreBreakdown = {
  fit: number;
  demand: number;
  exposure: number;
  theta: number;
  sdgMatch: 0 | 1;
  roleMomentum: number;
  rankScore: number;
  total: number;
  /** Total recomputed with momentum 0 for every skill (same demand, exposure and SDG). */
  noTrendTotal: number;
  components: {
    fit: { value: number; weight: number; points: number };
    demand: { value: number; weight: number; points: number };
    exposure: { value: number; weight: number; points: number };
    sdg: { value: 0 | 1; weight: number; points: number };
    trend: { value: number; weight: number; points: number };
  };
  skills: SkillBreakdown[];
};

export function scoreBreakdown(role: CandidateRole, opts: BreakdownOptions): ScoreBreakdown {
  const multiplier = opts.momentumMultiplier ?? 1.0;
  const theta = SCORING_PARAMS.theta[opts.scenario];

  const skills = role.essentialSkills.map((skill) => {
    const rawMomentum = opts.signals
      ? (opts.signals[skill.skillId]?.momentum ?? 0)
      : skill.momentum;
    const momentum = rawMomentum * multiplier;
    const importance = skillImportance(skill.baseImportance, momentum);
    return {
      skillId: skill.skillId,
      label: skill.label,
      level: skill.level,
      baseImportance: skill.baseImportance,
      momentum,
      importance,
      momentumContribution: importance - skill.baseImportance,
    };
  });

  const fit = roleFitScore(
    skills.map((skill) => ({ importance: skill.importance, level: skill.level })),
  );
  const demand = scenarioDemand(role.cluster, opts.scenario);
  const exposure = exposureScore(role.tasks);
  const sdgMatch: 0 | 1 = sdgInterestMatches(role.sdgLinks, opts.impactInterest) ? 1 : 0;
  const roleMom = opts.signals
    ? roleMomentum(
        role.essentialSkills.map((skill) => skill.skillId),
        opts.signals,
      ) * multiplier
    : (role.roleMomentum ?? 0) * multiplier;
  const trendFit = rankScore(fit, roleMom, opts.adoption);

  const total = scenarioRank({ fit: trendFit, demand, exposure, theta, sdgMatch: sdgMatch === 1 });

  const noTrendFit = roleFitScore(
    role.essentialSkills.map((skill) => ({
      importance: skillImportance(skill.baseImportance, 0),
      level: skill.level,
    })),
  );
  const noTrendTotal = scenarioRank({
    fit: noTrendFit,
    demand,
    exposure,
    theta,
    sdgMatch: sdgMatch === 1,
  });

  const fitPoints = SCORING_PARAMS.alpha * fit;
  const demandPoints = SCORING_PARAMS.beta * demand;
  const exposureValue = 1 - theta * exposure;
  const exposurePoints = SCORING_PARAMS.gamma * exposureValue;
  const sdgPoints = SCORING_PARAMS.sdgBonus * sdgMatch;
  const trendPoints = SCORING_PARAMS.alpha * (trendFit - fit);

  const importanceTotal = skills.reduce((sum, skill) => sum + skill.importance, 0);
  const cap = SCORING_PARAMS.essentialSkillCap;
  const denominator =
    skills.length > cap ? importanceTotal * (cap / skills.length) : importanceTotal;

  return {
    fit,
    demand,
    exposure,
    theta,
    sdgMatch,
    roleMomentum: roleMom,
    rankScore: trendFit,
    total,
    noTrendTotal,
    components: {
      fit: { value: fit, weight: SCORING_PARAMS.alpha, points: fitPoints },
      demand: { value: demand, weight: SCORING_PARAMS.beta, points: demandPoints },
      exposure: { value: exposureValue, weight: SCORING_PARAMS.gamma, points: exposurePoints },
      sdg: { value: sdgMatch, weight: SCORING_PARAMS.sdgBonus, points: sdgPoints },
      trend: { value: roleMom, weight: SCORING_PARAMS.trendBeta, points: trendPoints },
    },
    skills: skills.map((skill) => ({
      ...skill,
      fitPoints:
        denominator === 0
          ? 0
          : (SCORING_PARAMS.alpha * skill.importance * skill.level) / denominator,
    })),
  };
}

export type WhatIfItem = {
  skillId: string;
  label: string;
  fitBefore: number;
  fitAfter: number;
  totalBefore: number;
  totalAfter: number;
  deltaPoints: number;
};

export function whatIf(
  role: CandidateRole,
  opts: BreakdownOptions,
  limit = 5,
): WhatIfItem[] {
  const before = scoreBreakdown(role, opts);

  // Same order as skillGap in scoring.ts: importance, then teachable first, then skillId.
  const teachable = new Set(role.essentialSkills.filter((skill) => skill.teachable).map((skill) => skill.skillId));
  const missing = before.skills
    .filter((skill) => skill.level === 0)
    .sort(
      (a, b) =>
        b.importance - a.importance ||
        Number(teachable.has(b.skillId)) - Number(teachable.has(a.skillId)) ||
        (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0),
    )
    .slice(0, limit);

  return missing
    .map((skill) => {
      const after = scoreBreakdown(
        {
          ...role,
          essentialSkills: role.essentialSkills.map((item) =>
            item.skillId === skill.skillId
              ? { ...item, level: SCORING_PARAMS.skillLevel.full }
              : item,
          ),
        },
        opts,
      );
      return {
        skillId: skill.skillId,
        label: skill.label,
        fitBefore: before.fit,
        fitAfter: after.fit,
        totalBefore: before.total,
        totalAfter: after.total,
        deltaPoints: (after.total - before.total) * 100,
      };
    })
    .sort(
      (a, b) =>
        b.deltaPoints - a.deltaPoints ||
        (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0),
    );
}

/**
 * Calibration method: raw fit F is a share of a role's importance-weighted
 * essential skills, so a real CV rarely exceeds ~0.25 on any role. The
 * calibrated value divides F by a fixed global denominator
 * (SCORING_PARAMS.fitCalibrationDenominator, the p95 raw fit over the
 * reference personas x occupations), capped at 1. Because the denominator is
 * the same for everyone, calibrated scores compare across users rather than
 * being relative to each user's own best role. It is a monotone rescale, so
 * it never changes ranking, and the raw F is always shown beside it. A
 * denominator of 0 or less yields 0.
 */
export function calibrateFit(
  rawFit: number,
  denominator: number = SCORING_PARAMS.fitCalibrationDenominator,
): number {
  return denominator <= 0 ? 0 : Math.min(1, rawFit / denominator);
}

/** Ranking by fit descending, then occupationId ascending (1-based). */
export function fitRank(
  fits: ReadonlyArray<{ occupationId: string; fit: number }>,
  occupationId: string,
): { rank: number; total: number } {
  const ordered = [...fits].sort(
    (a, b) => b.fit - a.fit || (a.occupationId < b.occupationId ? -1 : a.occupationId > b.occupationId ? 1 : 0),
  );
  const rank = ordered.findIndex((item) => item.occupationId === occupationId) + 1;
  return { rank, total: ordered.length };
}
