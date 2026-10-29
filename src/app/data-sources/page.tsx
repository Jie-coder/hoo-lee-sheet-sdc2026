// /data-sources (spec §9): one ticket per source. Dates come from the
// catalogue (sources.csv, courses.csv, occupation_sdg.csv); the arXiv date is
// the trend snapshot in use (live refresh, else keywords.csv). Anything
// without a date in the data renders as a placeholder.
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DataSourcesView, type SourceDates } from "@/components/data-sources-view";
import { trendInfo } from "@/lib/trend-info";
import { CATALOGUE } from "@/lib/catalogue";
import { getActiveSignals } from "@/lib/signals";
import type { IsoDate } from "@/types/contracts";

export const metadata: Metadata = {
  title: "Data sources",
};

function latest(dates: (IsoDate | null | undefined)[]): IsoDate | null {
  const known = dates.filter((date): date is IsoDate => Boolean(date)).sort();
  return known.length ? known[known.length - 1] : null;
}

async function LiveDataSources() {
  await connection();
  const active = await getActiveSignals();
  const sources = CATALOGUE.sources;
  const dates: SourceDates = {
    ilo: sources["ILO GenAI Exposure 2025"]?.lastUpdated ?? null,
    esco: sources["ESCO"]?.lastUpdated ?? null,
    dosmWages: sources["OpenDOSM Salaries & Wages by Occupation"]?.lastUpdated ?? null,
    dosmReport: null,
    jobstreet: null,
    wefJobs: sources["WEF Future of Jobs Report 2025"]?.lastUpdated ?? null,
    sdgs: latest(CATALOGUE.occupations.flatMap((occupation) => occupation.sdg.map((sdg) => sdg.checkedOn))),
    arxiv: active.snapshot.asOf,
    courses: latest(CATALOGUE.courses.map((course) => course.lastChecked)),
  };
  return <DataSourcesView dates={dates} trend={trendInfo(active)} signals={{ snapshot: active.snapshot, trend: active.trend }} />;
}

export default function Page() {
  return (
    <Suspense>
      <LiveDataSources />
    </Suspense>
  );
}
