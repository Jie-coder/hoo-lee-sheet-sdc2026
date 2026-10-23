// /data-sources (spec §9): one ticket per source. Dates come from the
// catalogue (sources.csv, keywords.csv, courses.csv, occupation_sdg.csv);
// anything without a date in the data renders as a placeholder.
import type { Metadata } from "next";
import { DataSourcesView, type SourceDates } from "@/components/data-sources-view";
import { CATALOGUE } from "@/lib/catalogue";
import type { IsoDate } from "@/types/contracts";

export const metadata: Metadata = {
  title: "Data sources",
};

function latest(dates: (IsoDate | null | undefined)[]): IsoDate | null {
  const known = dates.filter((date): date is IsoDate => Boolean(date)).sort();
  return known.length ? known[known.length - 1] : null;
}

export default function Page() {
  const sources = CATALOGUE.sources;
  const dates: SourceDates = {
    ilo: sources["ILO GenAI Exposure 2025"]?.lastUpdated ?? null,
    esco: sources["ESCO"]?.lastUpdated ?? null,
    dosmWages: sources["OpenDOSM Salaries & Wages by Occupation"]?.lastUpdated ?? null,
    dosmReport: null,
    jobstreet: null,
    wefJobs: sources["WEF Future of Jobs Report 2025"]?.lastUpdated ?? null,
    sdgs: latest(CATALOGUE.occupations.flatMap((occupation) => occupation.sdg.map((sdg) => sdg.checkedOn))),
    arxiv: CATALOGUE.signalsAsOf ?? null,
    courses: latest(CATALOGUE.courses.map((course) => course.lastChecked)),
  };
  return <DataSourcesView dates={dates} />;
}
