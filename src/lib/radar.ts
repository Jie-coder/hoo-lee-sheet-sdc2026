// Future Skills Radar (brief, journey step 2): which skills and roles are
// rising or declining, from the dated arXiv keyword counts. Pure; the page
// at /radar renders it for both snapshots so the toggle can switch.
//
// A skill's trend is the momentum of the arXiv keywords mapped to it:
//   m = ln((papers in the last 90 days + 1) / (papers in the 90 days before + 1))
// A role's trend is the mean momentum of its ESCO essential skills that have
// a signal. Most roles have few such skills, so every role says how many.
import type { SignalDate } from "@/lib/analyze";
import type { Catalogue, CatalogueKeyword } from "@/lib/catalogue";
import { roleMomentum, skillMomentum } from "@/lib/scoring";
import type { IsoDate } from "@/types/contracts";

export type RadarSkill = {
  skillId: string;
  label: string;
  momentum: number;
  /** Uncertainty band around the momentum, from the keyword paper counts. */
  band: MomentumBand | null;
  /** The keywords behind it, with their own counts and checkable arXiv URL. */
  keywords: CatalogueKeyword[];
};

export type RadarRole = {
  occupationId: string;
  title: string;
  momentum: number;
  /** Essential skills with a trend signal, out of all essential skills. */
  signalSkills: { label: string; momentum: number }[];
  essentialSkills: number;
};

export type Radar = {
  signalDate: SignalDate;
  asOf: IsoDate;
  window: { recent: { start: IsoDate; end: IsoDate }; previous: { start: IsoDate; end: IsoDate } };
  rising: RadarSkill[];
  declining: RadarSkill[];
  /** Momentum within ±FLAT_MOMENTUM: no clear direction. */
  steady: RadarSkill[];
  risingRoles: RadarRole[];
  /** Every role with a signal, highest momentum first (ties by title); includes roles at or below zero. */
  rolesByMomentum: RadarRole[];
  decliningRoles: RadarRole[];
  /** Roles with no essential skill that has a signal: the radar can't say. */
  rolesWithoutSignal: number;
  /** Keywords with too few papers to read as a trend (shown so nothing is hidden). */
  tooSmall: CatalogueKeyword[];
};

/** ln(1.1) ≈ 0.095: the same ±10% band as the keyword "flat" direction. */
export const FLAT_MOMENTUM = Math.log(1.1);

/** Two-sided 95% normal critical value, for the momentum uncertainty band. */
export const MOMENTUM_Z95 = 1.96;

export type MomentumBand = {
  momentum: number;
  se: number;
  low: number;
  high: number;
  crossesZero: boolean;
};

/**
 * Delta-method standard error of m = ln((r + 1) / (p + 1)) when r and p are
 * Poisson counts: sqrt(1 / (r + 1) + 1 / (p + 1)).
 */
export function keywordMomentumSE(recent: number, previous: number): number {
  return Math.sqrt(1 / (recent + 1) + 1 / (previous + 1));
}

/**
 * Mean keyword momentum with a 95% uncertainty band. The keywords are treated
 * as independent, so the variance of the mean is the sum of the keyword
 * variances divided by k². Returns null when there are no keywords.
 */
export function skillMomentumBand(
  keywords: Pick<CatalogueKeyword, "recent" | "previous">[],
): MomentumBand | null {
  if (keywords.length === 0) return null;
  const k = keywords.length;
  const momenta = keywords.map((keyword) => skillMomentum(keyword.recent, keyword.previous));
  const momentum = momenta.reduce((sum, value) => sum + value, 0) / k;
  const variance =
    keywords.reduce((sum, keyword) => sum + keywordMomentumSE(keyword.recent, keyword.previous) ** 2, 0) / k ** 2;
  const se = Math.sqrt(variance);
  const low = momentum - MOMENTUM_Z95 * se;
  const high = momentum + MOMENTUM_Z95 * se;
  return { momentum, se, low, high, crossesZero: low < 0 && high > 0 };
}

const TOP_ROLES = 5;

export function buildRadar(catalogue: Catalogue, signalDate: SignalDate): Radar | null {
  const usePrior = signalDate === "prior" && catalogue.keywords.prior && catalogue.priorSignals;
  const keywords = usePrior ? (catalogue.keywords.prior as CatalogueKeyword[]) : catalogue.keywords.today;
  const signals = usePrior ? (catalogue.priorSignals as Catalogue["signals"]) : catalogue.signals;
  const asOf = usePrior ? (catalogue.priorSignalsAsOf as IsoDate) : catalogue.signalsAsOf;
  const usable = keywords.filter((keyword) => keyword.enough);
  if (usable.length === 0) return null;

  const skills: RadarSkill[] = Object.entries(signals)
    .map(([skillId, signal]) => {
      const skillKeywords = usable.filter((keyword) => keyword.skillIds.includes(skillId));
      return {
        skillId,
        label: catalogue.skills[skillId] ?? skillId,
        momentum: signal.momentum,
        band: skillMomentumBand(skillKeywords),
        keywords: skillKeywords,
      };
    })
    .sort((a, b) => b.momentum - a.momentum || a.label.localeCompare(b.label));

  const roles: RadarRole[] = catalogue.occupations
    .map((occupation) => {
      const signalSkills = occupation.essentialSkillIds
        .filter((id) => signals[id])
        .map((id) => ({ label: catalogue.skills[id] ?? id, momentum: signals[id].momentum }));
      const momentum = roleMomentum(occupation.essentialSkillIds, signals);
      return {
        occupationId: occupation.id,
        title: occupation.title,
        momentum,
        signalSkills,
        essentialSkills: occupation.essentialSkillIds.length,
      };
    })
    .filter((role) => role.signalSkills.length > 0);

  const byMomentum = [...roles].sort((a, b) => b.momentum - a.momentum || a.title.localeCompare(b.title));

  return {
    signalDate: usePrior ? "prior" : "today",
    asOf,
    window: { recent: usable[0].recentWindow, previous: usable[0].previousWindow },
    rising: skills.filter((skill) => skill.momentum > FLAT_MOMENTUM),
    declining: skills.filter((skill) => skill.momentum < -FLAT_MOMENTUM).reverse(),
    steady: skills.filter((skill) => Math.abs(skill.momentum) <= FLAT_MOMENTUM),
    rolesByMomentum: byMomentum,
    risingRoles: byMomentum.filter((role) => role.momentum > 0).slice(0, TOP_ROLES),
    decliningRoles: [...byMomentum].reverse().filter((role) => role.momentum < 0).slice(0, TOP_ROLES),
    rolesWithoutSignal: catalogue.occupations.length - roles.length,
    tooSmall: keywords.filter((keyword) => !keyword.enough),
  };
}

/** "+12%" / "−8%": the change in papers between the two windows, for one keyword. */
export function percentChange(keyword: Pick<CatalogueKeyword, "recent" | "previous">): string {
  const change = ((keyword.recent - keyword.previous) / Math.max(keyword.previous, 1)) * 100;
  const rounded = Math.round(change);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : "±"}${Math.abs(rounded)}%`;
}
