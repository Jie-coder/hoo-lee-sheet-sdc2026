import type { Catalogue, CatalogueOccupation } from "@/lib/catalogue";
import {
  SCORING_PARAMS,
  compareId,
  roleFitScore,
  skillImportance,
} from "@/lib/scoring";

/** Neutral skill weight, the same value analyze.ts and the importer use. */
const BASE_IMPORTANCE = 1;

export type CalibrationProfileSkill = { skillId: string; level: number };

/**
 * Levels for one role's essential skills, using the same resolution as
 * analyzeProfile: an exact skill keeps the user's level; otherwise a skill in
 * the same ESCO group gets half credit, capped to the relatedSkillCap most
 * important related skills; everything else is missing.
 */
function levelsFor(
  catalogue: Catalogue,
  occupation: CatalogueOccupation,
  userLevel: ReadonlyMap<string, number>,
  groupLevel: ReadonlyMap<string, number>,
): Map<string, number> {
  const levels = new Map<string, number>();
  const related: { skillId: string; credit: number; imp: number }[] = [];
  for (const skillId of occupation.essentialSkillIds) {
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
      imp: skillImportance(BASE_IMPORTANCE, catalogue.signals[skillId]?.momentum ?? 0),
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
}

/**
 * Raw fit for one profile against every occupation, using today's signals and
 * the same role-level fit as analyzeProfile (no trend boost, no display bonus).
 */
function rawFitsFor(
  catalogue: Catalogue,
  profile: readonly CalibrationProfileSkill[],
): number[] {
  const userLevel = new Map<string, number>();
  const groupLevel = new Map<string, number>();
  for (const skill of profile) {
    userLevel.set(skill.skillId, Math.max(userLevel.get(skill.skillId) ?? 0, skill.level));
    const group = catalogue.skillGroups[skill.skillId];
    if (group) groupLevel.set(group, Math.max(groupLevel.get(group) ?? 0, skill.level));
  }

  return catalogue.occupations.map((occupation) => {
    const levels = levelsFor(catalogue, occupation, userLevel, groupLevel);
    return roleFitScore(
      occupation.essentialSkillIds.map((skillId) => ({
        importance: skillImportance(BASE_IMPORTANCE, catalogue.signals[skillId]?.momentum ?? 0),
        level: levels.get(skillId) ?? SCORING_PARAMS.skillLevel.missing,
      })),
    );
  });
}

/** Nearest-rank quantile over an ascending-sorted array. */
function nearestRank(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(quantile * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

/**
 * Fixed fit denominator: the p95 (nearest-rank) of the non-zero raw fits for
 * every profile x every occupation in the reference population, using today's
 * signals. Zero fits are dropped so roles nobody can match do not pull the
 * quantile down. This is the value SCORING_PARAMS.fitCalibrationDenominator
 * pins, so calibrated scores compare across users instead of being relative
 * to each user's own best role.
 */
export function computeFitCalibrationDenominator(
  catalogue: Catalogue,
  profiles: readonly (readonly CalibrationProfileSkill[])[],
  quantile = 0.95,
): number {
  const fits = profiles
    .flatMap((profile) => rawFitsFor(catalogue, profile))
    .filter((fit) => fit > 0)
    .sort((a, b) => a - b);

  return nearestRank(fits, quantile);
}
