// Future Skills Radar: rising, flat and declining skills from the dated arXiv
// keyword counts in data/keywords.csv and data/keywords_prior.csv, plus the
// roles that list each skill as essential and those roles' SDG target.
import type { Metadata } from "next";
import { RadarView, type SkillLinks } from "@/components/radar-view";
import { CATALOGUE } from "@/lib/catalogue";
import { buildRadar } from "@/lib/radar";

export const metadata: Metadata = {
  title: "Future Skills Radar",
};

const MAX_LINKED_ROLES = 5;

function skillLinks(): SkillLinks {
  const links: SkillLinks = {};
  for (const skillId of Object.keys(CATALOGUE.signals)) {
    const roles = CATALOGUE.occupations.filter((occupation) => occupation.essentialSkillIds.includes(skillId));
    const sdg = roles.flatMap((role) => role.sdg).find((target) => target.tier === "direct") ?? roles[0]?.sdg[0] ?? null;
    links[skillId] = {
      roles: roles.slice(0, MAX_LINKED_ROLES).map((role) => ({ id: role.id, title: role.title })),
      totalRoles: roles.length,
      sdg: sdg ? { target: sdg.target, label: sdg.label } : null,
    };
  }
  return links;
}

export default function RadarPage() {
  return (
    <RadarView
      today={buildRadar(CATALOGUE, "today")}
      prior={CATALOGUE.priorSignalsAsOf ? buildRadar(CATALOGUE, "prior") : null}
      dates={{ today: CATALOGUE.signalsAsOf, prior: CATALOGUE.priorSignalsAsOf }}
      links={skillLinks()}
    />
  );
}
