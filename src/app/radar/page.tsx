// Future Skills Radar: rising, flat and declining skills from the dated arXiv
// keyword counts: the newest live snapshot (POST /api/refresh-signals), else
// the counts bundled from data/keywords.csv; the "30 days earlier" toggle
// uses data/keywords_prior.csv. Plus the roles that list each skill as
// essential and those roles' SDG target.
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RadarView, type SkillLinks } from "@/components/radar-view";
import { trendInfo } from "@/lib/trend-info";
import type { Catalogue } from "@/lib/catalogue";
import { buildRadar } from "@/lib/radar";
import { catalogueFor, getActiveSignals } from "@/lib/signals";

export const metadata: Metadata = {
  title: "Future Skills Radar",
};

const MAX_LINKED_ROLES = 5;

function skillLinks(catalogue: Catalogue): SkillLinks {
  const links: SkillLinks = {};
  for (const skillId of Object.keys(catalogue.signals)) {
    const roles = catalogue.occupations.filter((occupation) => occupation.essentialSkillIds.includes(skillId));
    const sdg = roles.flatMap((role) => role.sdg).find((target) => target.tier === "direct") ?? roles[0]?.sdg[0] ?? null;
    links[skillId] = {
      roles: roles.slice(0, MAX_LINKED_ROLES).map((role) => ({ id: role.id, title: role.title })),
      totalRoles: roles.length,
      sdg: sdg ? { target: sdg.target, label: sdg.label } : null,
    };
  }
  return links;
}

async function LiveRadar() {
  await connection();
  const active = await getActiveSignals();
  const catalogue = catalogueFor(active);
  return (
    <RadarView
      today={buildRadar(catalogue, "today")}
      prior={catalogue.priorSignalsAsOf ? buildRadar(catalogue, "prior") : null}
      dates={{ today: catalogue.signalsAsOf, prior: catalogue.priorSignalsAsOf }}
      links={skillLinks(catalogue)}
      trend={trendInfo(active)}
    />
  );
}

export default function RadarPage() {
  return (
    <Suspense>
      <LiveRadar />
    </Suspense>
  );
}
