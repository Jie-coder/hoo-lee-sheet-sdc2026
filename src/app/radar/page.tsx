// Future Skills Radar: rising and declining skills and roles from the dated
// arXiv keyword counts in data/keywords.csv and data/keywords_prior.csv.
import type { Metadata } from "next";
import { RadarView } from "@/components/radar-view";
import { CATALOGUE } from "@/lib/catalogue";
import { buildRadar } from "@/lib/radar";

export const metadata: Metadata = {
  title: "Future Skills Radar",
};

export default function RadarPage() {
  return (
    <RadarView
      today={buildRadar(CATALOGUE, "today")}
      prior={CATALOGUE.priorSignalsAsOf ? buildRadar(CATALOGUE, "prior") : null}
      dates={{ today: CATALOGUE.signalsAsOf, prior: CATALOGUE.priorSignalsAsOf }}
      totalRoles={CATALOGUE.occupations.length}
    />
  );
}
