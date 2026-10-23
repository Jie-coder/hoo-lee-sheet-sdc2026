// Pure scoring for Laluan (brief sections 05, 06, and 09).
// No network, database, clock, or LLM. Same input, same output.
//
// Formulas, read off the section 05 images:
//   E = Σ_i (w_i · a_i), with the constraint Σ_i w_i = 1
//   G = Σ_i (w_i · g_i), with the same constraint
//   m_s = ln((c_recent + 1) / (c_previous + 1))
//   imp_s = b_s · (1 + λ · tanh(m_s))
//   F_r = Σ_{s in S_r} (imp_s · h_s) / Σ_{s in S_r} imp_s
//     capped: once a role has more than 25 essential skills, the
//     denominator is scaled down to what 25 skills would sum to (see
//     essentialSkillCap below), and F is clamped to at most 1.
//   R_{r,k} = α F_r + β D_{r,k} + γ (1 − θ_k E_r)
//   then +0.05 when a direct or supporting SDG link matches impact_interest
//
// h_s is 1 (clear), 0.5 (partial, self-reported, or a related ESCO skill the
// user holds — see relatedSkillCredit below), or 0 (missing).
// A user skill matches an essential skill when cosine >= 0.82.
//
// For a hackathon judge, in plain English:
// - A related skill (same ESCO skill group as something the user holds, but
//   not the exact skill) earns relatedSkillCredit = 0.5 of a full match:
//   half credit for "close enough". It rewards transferable skills without
//   treating them as a substitute for the real thing.
// - Each role only counts the top relatedSkillCap = 6 related skills (by
//   adjusted importance imp_s, i.e. the 6 most important skills; ties break
//   by skillId). This stops "related skill padding": a broad CV with a
//   handful of adjacent skills can't pad its fit score by racking up related
//   credit on every essential skill of a role — only the 6 most important
//   ones count, and the rest fall back to missing. Capping it keeps the
//   credit a small nudge, not a second scoring channel.
// - Roles with more than essentialSkillCap = 25 essential skills have the
//   fit denominator scaled down to a 25-skill-equivalent sum. Without this,
//   a role that lists dozens of essential skills is nearly unreachable (you
//   would need to match almost all of them to clear a few matches you'd get
//   on a shorter list), which unfairly buries broad roles in the rankings.
//   F is clamped to at most 1 so the scaled-down denominator can never push
//   a score above a full match.
//
// Ambiguities, and the reading used here:
// - The exposure and augmentation images print (Σ w_i = 1) beside the sum.
//   That is a constraint, not a divisor. Shares are not rescaled. An empty
//   task list, or one whose shares are all zero, scores 0.
// - Prose calls the signal c_s ("papers in the last 90 days vs the 90 days
//   before"). The image defines m_s as the log ratio above, with +1 so a
//   zero window is defined, and feeds m_s into tanh. Callers that already
//   have m_s pass it to skillImportance; skillMomentum builds it from counts.
// - Fit is undefined when the importance total is 0 (no essential skills, or
//   every base importance is 0). That returns 0.
// - A gap is an essential skill with h_s = 0. Partial (0.5) is not missing.
//   When several user skills clear the cosine threshold, h_s is the highest
//   of their levels.
// - The ranking image is α F + β D + γ (1 − θ E), a weighted sum whose third
//   term is the exposure penalty. R is not clamped.
// - The brief does not say which SDG targets match each impact_interest.
//   impactGoals below is the small map used: environment 6, 7, 12–15,
//   education 4, health 3, community 1, 10, 11.
//   "none" matches nothing. Inferred links do not count. The +0.05 is added
//   once per role, to every scenario's R, not once per link.
// - Top 3 is exactly min(3, n) after sorting by R descending, then
//   occupationId ascending. Ties do not expand the cut. robust means the
//   role is inside that cut in every scenario. The returned list is the
//   union of the three cuts, ordered by the co-pilot R then occupationId.
// - Display bands stay in contracts.scoreBand. Values here are full precision;
//   two-decimal display is a UI rule and is not applied, so rounding cannot
//   change a rank.
//
// Minimum fit filter, for a hackathon judge:
// - Top 3 per scenario is picked only from roles with F >= minFit (0.13).
//   Without this, a role that scores only on demand and exposure can take a
//   top-3 slot with essentially no actual skill overlap (e.g. a Solar energy
//   technician at F=0 next to an IT-skilled CV) — ranking on demand/exposure
//   alone, with fit at zero, is not a recommendation a learner can act on.
// - 0.13 was picked by hand against the demo CVs: it keeps the closest real
//   matches (e.g. Environmental scientist at F≈0.14 for an environmental-
//   science CV) while dropping weak matches at F=0.12 and below.
// - If fewer than topN roles clear minFit for a scenario, that scenario
//   retries with minFitFallback (0.10), a looser bar. If that still is not
//   enough, that scenario falls back to no filter at all, so every scenario
//   always shows topN roles when that many candidates exist — a demo should
//   never show an empty slate because every role scored low.

import {
  SCENARIO_IDS,
  type ClusterId,
  type GapSkill,
  type ImpactInterest,
  type RoleResult,
  type ScenarioId,
  type ScenarioScores,
} from "../types/contracts";

/**
 * Weights, theta and thresholds are illustrative demo values from the brief
 * (sections 05, 06, and 09), not fitted. demandByCluster is computed from
 * data (see its comment).
 */
export const SCORING_PARAMS = {
  alpha: 0.5,
  beta: 0.3,
  gamma: 0.2,
  lambda: 0.3,
  skillMatchCosine: 0.82,
  sdgBonus: 0.05,
  topN: 3,
  gapSize: 5,
  /** Half credit for an essential skill in the same ESCO group as a user skill, not the exact match. See the file header. */
  relatedSkillCredit: 0.5,
  /** At most the 6 most important related skills per role count, so a broad CV can't pad fit with adjacent skills. See the file header. */
  relatedSkillCap: 6,
  /** Essential-skill count above which the fit denominator is scaled down. See the file header. */
  essentialSkillCap: 25,
  /** Minimum fit F a role needs to be eligible for a scenario's top 3. See "Minimum fit filter" in the file header. */
  minFit: 0.13,
  /** Looser fit bar used for a scenario only when minFit leaves fewer than topN roles eligible. See the file header. */
  minFitFallback: 0.1,
  skillLevel: { full: 1, partial: 0.5, missing: 0 },
  theta: { co: 1.0, dis: 1.4, sup: 1.2 },
  /**
   * Demand D_{r,k} by role cluster and scenario, computed from
   * data/demand.csv (OpenDOSM employees by ISCO major group, 2024 -> 2025)
   * and data/scenarios.csv (WEF Future of Jobs Report 2025 net growth by
   * role, with page numbers) by scripts/lib/scenario-demand.ts, rounded to 4
   * decimals. Our model, not a published statistic: see data/README.md.
   * scripts/lib/scenario-demand.test.ts fails if these drift from the CSVs.
   * human_care is the same in every scenario: WEF prints a figure for only
   * one of its roles (Vocational Education Teachers, +9%).
   */
  demandByCluster: {
    ai_digital: { co: 0.8593, dis: 0.7088, sup: 1.0 },
    data_analytics: { co: 0.6978, dis: 0.5659, sup: 0.7747 },
    green_sustainability: { co: 0.7094, dis: 0.6439, sup: 0.7531 },
    human_care: { co: 0.5976, dis: 0.5976, sup: 0.5976 },
    routine_clerical: { co: 0.4672, dis: 0.4035, sup: 0.5344 },
  } satisfies Record<ClusterId, Record<ScenarioId, number>>,
  /**
   * Goal numbers (the integer in "13.3") treated as matching each interest.
   * See the ambiguity note at the top of this file.
   */
  impactGoals: {
    // 6 water, 7 energy, 12 waste and reporting, 13 climate, 14–15 ecosystems.
    environment: [6, 7, 12, 13, 14, 15],
    education: [4],
    health: [3],
    // 1 poverty, 10 inclusion, 11 cities and communities.
    community: [1, 10, 11],
    none: [] as readonly number[],
  },
} as const;

export type RoleCluster = ClusterId;

export type WeightedTask = {
  share: number;
  automation: number;
  augmentation: number;
};

/** Essential skill of a role, with momentum m_s already computed and h_s resolved. */
export type EssentialSkillInput = {
  skillId: string;
  label: string;
  baseImportance: number;
  momentum: number;
  level: number;
  /** A catalogue course teaches it. Breaks importance ties in the gap, so gaps you can act on come first. */
  teachable?: boolean;
};

export type SkillCandidate = {
  cosine: number;
  /** 1 if the user clearly has it, 0.5 if partial or self-reported. */
  level: number;
};

export type SdgInterestLink = {
  target: string;
  tier: "direct" | "supporting" | "inferred";
};

export type CandidateRole = {
  occupationId: string;
  title: string;
  cluster: RoleCluster;
  tasks: readonly WeightedTask[];
  essentialSkills: readonly EssentialSkillInput[];
  sdgLinks: readonly SdgInterestLink[];
};

/** Numeric fields of a role card. SDG links, sources, and copy are added later. */
export type ScoredRole = Pick<
  RoleResult,
  | "occupationId"
  | "title"
  | "fit"
  | "exposure"
  | "augmentation"
  | "byScenario"
  | "robust"
  | "gap"
>;

/** E = Σ w_i a_i. Shares are not renormalized; see the file header. */
/**
 * Clusters never offered as a future route. Routine clerical roles (data
 * entry, bookkeeping, teller, call centre, reception, admin, cashier,
 * payroll) are the jobs most exposed to AI automation, so recommending them
 * as a move contradicts the product. They can still be the user's current
 * (at-risk) job — only the recommended list excludes them. Applied once, in
 * analyzeProfile's candidate filter, so /api/roles, results, compare and
 * print all see the same list.
 */
/**
 * Recommended roles with skill fit below this read as a "Transition route"
 * (BM "Laluan peralihan"): a deliberate reskilling move rather than a close
 * match. Display only; it does not change ranking.
 */
export const STRETCH_FIT_THRESHOLD = 0.2;

/** True when a recommended role's fit is below STRETCH_FIT_THRESHOLD. */
export function isStretchRoute(fit: number): boolean {
  return fit < STRETCH_FIT_THRESHOLD;
}

export const NON_RECOMMENDED_CLUSTERS: ReadonlySet<RoleCluster> = new Set<RoleCluster>(["routine_clerical"]);

export function exposureScore(
  tasks: readonly { share: number; automation: number }[],
): number {
  return tasks.reduce((sum, task) => sum + task.share * task.automation, 0);
}

/** G = Σ w_i g_i. Same weight constraint as exposure. */
export function augmentationScore(
  tasks: readonly { share: number; augmentation: number }[],
): number {
  return tasks.reduce((sum, task) => sum + task.share * task.augmentation, 0);
}

/**
 * m_s = ln((c_recent + 1) / (c_previous + 1)).
 * Counts are arXiv papers in the last 90 days and the 90 days before.
 */
export function skillMomentum(recentPapers: number, previousPapers: number): number {
  return Math.log((recentPapers + 1) / (previousPapers + 1));
}

/** imp_s = b_s (1 + λ tanh(m_s)). */
export function skillImportance(baseImportance: number, momentum: number): number {
  return baseImportance * (1 + SCORING_PARAMS.lambda * Math.tanh(momentum));
}

/** True when embedding cosine meets the match threshold (inclusive). */
export function skillsMatch(cosine: number): boolean {
  return cosine >= SCORING_PARAMS.skillMatchCosine;
}

/**
 * h_s for one essential skill. Candidates below the cosine threshold are
 * ignored. Several matches keep the highest level. No match is missing (0).
 */
export function matchedSkillLevel(candidates: readonly SkillCandidate[]): number {
  let best: number = SCORING_PARAMS.skillLevel.missing;
  for (const candidate of candidates) {
    if (skillsMatch(candidate.cosine) && candidate.level > best) {
      best = candidate.level;
    }
  }
  return best;
}

/**
 * F_r = Σ (imp_s · h_s) / Σ imp_s over essential skills.
 * Returns 0 when the denominator (before any cap) is 0.
 *
 * Once a role lists more than essentialSkillCap (25) essential skills, the
 * denominator is scaled down to what 25 skills would sum to on average, so
 * roles with unusually long skill lists stay reachable. F is then clamped
 * to at most 1, since the scaled-down denominator can otherwise be smaller
 * than the matched weight.
 */
export function roleFitScore(
  skills: readonly { importance: number; level: number }[],
): number {
  let weighted = 0;
  let total = 0;
  for (const skill of skills) {
    total += skill.importance;
    weighted += skill.importance * skill.level;
  }
  if (total === 0) return 0;
  const { essentialSkillCap } = SCORING_PARAMS;
  const n = skills.length;
  const denominator = n > essentialSkillCap ? total * (essentialSkillCap / n) : total;
  return Math.min(weighted / denominator, 1);
}

/** D_{r,k} from SCORING_PARAMS.demandByCluster (DOSM + WEF, see above). */
export function scenarioDemand(cluster: RoleCluster, scenario: ScenarioId): number {
  return SCORING_PARAMS.demandByCluster[cluster][scenario];
}

/**
 * R_{r,k} = α F + β D + γ (1 − θ E), plus the SDG bonus when sdgMatch is set.
 */
export function scenarioRank(input: {
  fit: number;
  demand: number;
  exposure: number;
  theta: number;
  sdgMatch?: boolean;
}): number {
  const { alpha, beta, gamma, sdgBonus } = SCORING_PARAMS;
  const ranked =
    alpha * input.fit +
    beta * input.demand +
    gamma * (1 - input.theta * input.exposure);
  return input.sdgMatch ? ranked + sdgBonus : ranked;
}

function goalNumber(target: string): number | null {
  const match = /^(\d+)\./.exec(target);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * True when any direct or supporting link's goal is in the interest map.
 * Inferred links and interest "none" do not qualify. One match is enough.
 */
export function sdgInterestMatches(
  links: readonly SdgInterestLink[],
  interest: ImpactInterest,
): boolean {
  const goals: readonly number[] = SCORING_PARAMS.impactGoals[interest];
  if (goals.length === 0) return false;
  return links.some((link) => {
    if (link.tier === "inferred") return false;
    const goal = goalNumber(link.target);
    return goal != null && goals.some((item) => item === goal);
  });
}

/** Deterministic ascending string tie-break, shared by every sort in this file. */
export function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Top gapSize missing essential skills (h_s = 0), by adjusted importance
 * descending. Equal importance puts teachable skills first (a catalogue
 * course closes them), then breaks ties by skillId ascending.
 */
export function skillGap(skills: readonly EssentialSkillInput[]): GapSkill[] {
  return skills
    .filter((skill) => skill.level === SCORING_PARAMS.skillLevel.missing)
    .map((skill) => ({
      gap: {
        skillId: skill.skillId,
        label: skill.label,
        importance: skillImportance(skill.baseImportance, skill.momentum),
      },
      teachable: skill.teachable ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.gap.importance - a.gap.importance ||
        b.teachable - a.teachable ||
        compareId(a.gap.skillId, b.gap.skillId),
    )
    .slice(0, SCORING_PARAMS.gapSize)
    .map((item) => item.gap);
}

type PreparedRole = {
  role: CandidateRole;
  fit: number;
  exposure: number;
  augmentation: number;
  byScenario: ScenarioScores;
  gap: GapSkill[];
};

/** The fields topRoleIdsForScenario needs: enough to rank by scenario score and filter by fit. */
export type ScenarioRankable = {
  occupationId: string;
  fit: number;
  byScenario: ScenarioScores;
};

/**
 * Top SCORING_PARAMS.topN role ids for one scenario, sorted by that
 * scenario's R descending then occupationId ascending, restricted to roles
 * with fit >= SCORING_PARAMS.minFit. If that leaves fewer than topN roles,
 * retries with minFitFallback; if that is still not enough, falls back to
 * no fit filter. See "Minimum fit filter" in the file header. The single
 * place this rule is applied — scoreRoles below and analyze.ts (recomputing
 * robust/status over its already-filtered role list) both call it, so the
 * two "top 3 per scenario" computations stay in sync.
 */
export function topRoleIdsForScenario(roles: readonly ScenarioRankable[], scenario: ScenarioId): Set<string> {
  const { topN, minFit, minFitFallback } = SCORING_PARAMS;
  const ordered = [...roles].sort(
    (a, b) => b.byScenario[scenario] - a.byScenario[scenario] || compareId(a.occupationId, b.occupationId),
  );
  // Fit is always within [0, 1] (roleFitScore), so a threshold of 0 is the "no filter" step.
  for (const threshold of [minFit, minFitFallback, 0]) {
    const eligible = ordered.filter((role) => role.fit >= threshold);
    if (eligible.length >= topN || threshold === 0) {
      return new Set(eligible.slice(0, topN).map((role) => role.occupationId));
    }
  }
  /* istanbul ignore next -- threshold 0 above always returns */
  return new Set();
}

/**
 * Scores every candidate, keeps the top 3 per scenario, and marks a role
 * robust when it is in that top 3 for co, dis, and sup.
 */
export function scoreRoles(
  roles: readonly CandidateRole[],
  impactInterest: ImpactInterest,
): ScoredRole[] {
  const prepared: PreparedRole[] = roles.map((role) => {
    const exposure = exposureScore(role.tasks);
    const augmentation = augmentationScore(role.tasks);
    const fit = roleFitScore(
      role.essentialSkills.map((skill) => ({
        importance: skillImportance(skill.baseImportance, skill.momentum),
        level: skill.level,
      })),
    );
    const sdgMatch = sdgInterestMatches(role.sdgLinks, impactInterest);
    const byScenario = Object.fromEntries(
      SCENARIO_IDS.map((scenario) => [
        scenario,
        scenarioRank({
          fit,
          demand: scenarioDemand(role.cluster, scenario),
          exposure,
          theta: SCORING_PARAMS.theta[scenario],
          sdgMatch,
        }),
      ]),
    ) as ScenarioScores;

    return {
      role,
      fit,
      exposure,
      augmentation,
      byScenario,
      gap: skillGap(role.essentialSkills),
    };
  });

  const rankable: ScenarioRankable[] = prepared.map((item) => ({
    occupationId: item.role.occupationId,
    fit: item.fit,
    byScenario: item.byScenario,
  }));
  const topByScenario = Object.fromEntries(
    SCENARIO_IDS.map((scenario) => [scenario, topRoleIdsForScenario(rankable, scenario)]),
  ) as Record<ScenarioId, Set<string>>;

  return prepared
    .filter((item) =>
      SCENARIO_IDS.some((scenario) => topByScenario[scenario].has(item.role.occupationId)),
    )
    .sort(
      (a, b) =>
        b.byScenario.co - a.byScenario.co || compareId(a.role.occupationId, b.role.occupationId),
    )
    .map((item) => ({
      occupationId: item.role.occupationId,
      title: item.role.title,
      fit: item.fit,
      exposure: item.exposure,
      augmentation: item.augmentation,
      byScenario: item.byScenario,
      robust: SCENARIO_IDS.every((scenario) =>
        topByScenario[scenario].has(item.role.occupationId),
      ),
      gap: item.gap,
    }));
}
