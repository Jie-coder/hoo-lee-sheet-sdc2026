// Data sources (spec §9). Lists only sources whose data is used by code or data files
// (a source_name/source_url on a value row, or values derived from it):
// ILO -> data/exposure.csv, catalogue occupations; ESCO -> data/occupation_skills.csv,
// data/skill_groups.csv; DOSM -> data/salary_by_role.csv (avg pay), data/demand.csv;
// JobStreet -> data/salary_by_role.csv ranges; WEF FoJ 2025 -> data/scenarios.csv;
// arXiv -> data/keywords.csv (signals); UN SDGs -> data/occupation_sdg.csv;
// course catalogues -> data/courses.csv.
// Sources only listed in data/sources.csv (Anthropic Economic Index, Stanford AI Index,
// OECD.AI, GitHub Innovation Graph, Lightcast, OpenDOSM LFS, WEF Four Futures) are excluded.
"use client";

import Link from "next/link";
import { PageHero, Perforation, SourceRow, Ticket } from "@/components/caldera";
import { formatDayMonthYear, missingValue } from "@/lib/display";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";
import type { IsoDate } from "@/types/contracts";

export type SourceKey =
  | "ilo"
  | "esco"
  | "dosmWages"
  | "dosmReport"
  | "jobstreet"
  | "wefJobs"
  | "sdgs"
  | "arxiv"
  | "courses";
export type SourceDates = Record<SourceKey, IsoDate | null>;

export const DATA_SOURCES: ReadonlyArray<{ key: SourceKey; name: string; nameKey?: MessageKey; url: string | null; desc: MessageKey }> = [
  { key: "ilo", name: "ILO: Generative AI and Jobs (2025 refined global index, WP140)", url: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf", desc: "sourcesPage.ilo" },
  { key: "esco", name: "ESCO v1.2 (European Skills, Competences, Qualifications and Occupations)", url: "https://esco.ec.europa.eu/en/use-esco/use-esco-services-api", desc: "sourcesPage.esco" },
  { key: "wefJobs", name: "WEF Future of Jobs Report 2025", url: "https://reports.weforum.org/docs/WEF_Future_of_Jobs_Report_2025.pdf", desc: "sourcesPage.wefJobs" },
  { key: "jobstreet", name: "JobStreet Malaysia 2026: salary pages", url: "https://my.jobstreet.com/career-advice", desc: "sourcesPage.jobstreet" },
  { key: "arxiv", name: "arXiv API", url: "https://arxiv.org/help/api/index", desc: "sourcesPage.arxiv" },
  { key: "courses", name: "Course catalogues", nameKey: "sourcesPage.coursesName", url: null, desc: "sourcesPage.courses" },
  { key: "dosmWages", name: "OpenDOSM: Salaries & Wages by Occupation", url: "https://open.dosm.gov.my/data-catalogue/wages_occupation", desc: "sourcesPage.dosmWages" },
  { key: "dosmReport", name: "DOSM Salaries & Wages Survey Report 2025", url: "https://storage.dosm.gov.my/labour/salaries_wages_2025.pdf", desc: "sourcesPage.dosmReport" },
  { key: "sdgs", name: "UN Sustainable Development Goals", url: "https://sdgs.un.org/goals", desc: "sourcesPage.sdgs" },
];

function Expander({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group border-b-[1.5px] border-dashed border-card/30 py-5 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-bold">
        {summary}
        <span aria-hidden className="shrink-0 font-mono text-[12px] transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-card/85">{children}</div>
    </details>
  );
}

export function DataSourcesView({ dates }: { dates: SourceDates }) {
  const { t } = useT();
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-6 md:px-8">
      <PageHero
        className="pt-6 md:pt-10"
        eyebrow={t("sourcesPage.title")}
        title={t("sourcesPage.heroHeading")}
        lede={t("sourcesPage.lede")}
      />

      <ol className="mt-16 grid grid-cols-1 gap-4 md:mt-24 md:grid-cols-2 xl:grid-cols-3">
        {DATA_SOURCES.map((source, index) => {
          const date = dates[source.key];
          return (
            <li key={source.key}>
              <Ticket notch notchTop="62%" className="flex h-full flex-col p-7 md:p-8">
                <p className="font-mono text-[12px] tracking-[0.06em] text-sage-dark uppercase">
                  {t("sourcesPage.ticketNumber", { n: String(index + 1).padStart(2, "0") })}
                </p>
                <h2 className="mt-3 text-[20px] leading-snug font-bold">
                  {source.nameKey ? t(source.nameKey) : source.name}
                </h2>
                <p className="mt-2 mb-6 text-[15px] leading-relaxed text-grey">
                  <span className="sr-only">{t("sourcesPage.useLabel")}: </span>
                  {t(source.desc)}
                </p>
                <Perforation className="mt-auto" />
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-[11px] tracking-[0.06em] text-ink uppercase">
                    {t("sourcesPage.checkedLabel")} ·{" "}
                    {date ? formatDayMonthYear(date, t) : missingValue(t("common.notAvailable"))}
                  </p>
                  {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] tracking-[0.06em] text-sage-dark uppercase hover:underline"
                  >
                    {t("sourcesPage.openLink")} ↗
                  </a>
                  )}
                </div>
              </Ticket>
            </li>
          );
        })}
      </ol>

      <section className="mt-24 rounded-[40px] bg-plasma p-8 text-card md:mt-28 md:p-12">
        <p className="font-mono text-[12px] tracking-[0.06em] uppercase">{t("sourcesPage.methodLabel")}</p>
        <h2 className="mt-3 font-serif text-[clamp(36px,8vw,64px)] leading-[0.95] uppercase">{t("sourcesPage.methodHeading")}</h2>
        <div className="mt-8 max-w-[760px]">
          <Expander summary={t("exposurePage.whatHeading")}>
            <p>{t("exposurePage.whatBody")}</p>
            <p>{t("exposurePage.bandsBody")}</p>
          </Expander>
          <Expander summary={t("exposurePage.howHeading")}>
            <p>{t("exposurePage.howCatalogue")}</p>
            <p>{t("exposurePage.howMatch")}</p>
            <p>{t("exposurePage.howStatuses")}</p>
          </Expander>
        </div>
        <Link href="/exposure" className="mt-6 inline-block font-mono text-[12px] tracking-[0.06em] uppercase hover:underline">
          {t("aboutPage.exposureLink")} →
        </Link>
      </section>

      <SourceRow className="mt-10" />
    </main>
  );
}
