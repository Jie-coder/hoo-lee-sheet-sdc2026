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
import { roleMomentum } from "@/lib/scoring";
import type { IsoDate } from "@/types/contracts";

export type RadarSkill = {
  skillId: string;
  label: string;
  momentum: number;
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
  decliningRoles: RadarRole[];
  /** Roles with no essential skill that has a signal: the radar can't say. */
  rolesWithoutSignal: number;
  /** Keywords with too few papers to read as a trend (shown so nothing is hidden). */
  tooSmall: CatalogueKeyword[];
};

/** ln(1.1) ≈ 0.095: the same ±10% band as the keyword "flat" direction. */
export const FLAT_MOMENTUM = Math.log(1.1);

const TOP_ROLES = 5;

export function buildRadar(catalogue: Catalogue, signalDate: SignalDate): Radar | null {
  const usePrior = signalDate === "prior" && catalogue.keywords.prior && catalogue.priorSignals;
  const keywords = usePrior ? (catalogue.keywords.prior as CatalogueKeyword[]) : catalogue.keywords.today;
  const signals = usePrior ? (catalogue.priorSignals as Catalogue["signals"]) : catalogue.signals;
  const asOf = usePrior ? (catalogue.priorSignalsAsOf as IsoDate) : catalogue.signalsAsOf;
  const usable = keywords.filter((keyword) => keyword.enough);
  if (usable.length === 0) return null;

  const skills: RadarSkill[] = Object.entries(signals)
    .map(([skillId, signal]) => ({
      skillId,
      label: catalogue.skills[skillId] ?? skillId,
      momentum: signal.momentum,
      keywords: usable.filter((keyword) => keyword.skillIds.includes(skillId)),
    }))
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
