// Data sources page. Lists only sources whose data is used by code or data files
// (a source_name/source_url on a value row, or values derived from it):
// ILO -> data/exposure.csv, catalogue occupations; ESCO -> data/occupation_skills.csv,
// data/skill_groups.csv; DOSM -> data/salary_by_role.csv (avg pay), data/demand.csv;
// JobStreet -> data/salary_by_role.csv ranges; WEF FoJ 2025 -> data/scenarios.csv;
// arXiv -> data/keywords.csv (signals); UN SDGs -> data/occupation_sdg.csv.
// Sources only listed in data/sources.csv (Anthropic Economic Index, Stanford AI Index,
// OECD.AI, GitHub Innovation Graph, Lightcast, OpenDOSM LFS, WEF Four Futures) are excluded.
"use client";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";
import { InfoPage } from "@/components/info-page";

export const DATA_SOURCES: ReadonlyArray<{ name: string; url: string; desc: MessageKey }> = [
  { name: "ILO: Generative AI and Jobs (2025 refined global index, WP140)", url: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf", desc: "sourcesPage.ilo" },
  { name: "ESCO (European Skills, Competences, Qualifications and Occupations)", url: "https://esco.ec.europa.eu/en/use-esco/use-esco-services-api", desc: "sourcesPage.esco" },
  { name: "OpenDOSM: Salaries & Wages by Occupation", url: "https://open.dosm.gov.my/data-catalogue/wages_occupation", desc: "sourcesPage.dosmWages" },
  { name: "DOSM Salaries & Wages Survey Report 2025", url: "https://storage.dosm.gov.my/labour/salaries_wages_2025.pdf", desc: "sourcesPage.dosmReport" },
  { name: "JobStreet Malaysia career advice: salary pages", url: "https://my.jobstreet.com/career-advice", desc: "sourcesPage.jobstreet" },
  { name: "WEF Future of Jobs Report 2025", url: "https://reports.weforum.org/docs/WEF_Future_of_Jobs_Report_2025.pdf", desc: "sourcesPage.wefJobs" },
  { name: "UN Sustainable Development Goals", url: "https://sdgs.un.org/goals", desc: "sourcesPage.sdgs" },
  { name: "arXiv API", url: "https://arxiv.org/help/api/index", desc: "sourcesPage.arxiv" },
];

export function DataSourcesView() {
  const { t } = useT();
  return (
    <InfoPage title={t("sourcesPage.title")} lede={t("sourcesPage.lede")}>
      <ul className="mt-16 space-y-2">
        {DATA_SOURCES.map((s) => (
          <li key={s.url} className="rounded-2xl bg-[#f7f6f2] px-5 py-4">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sage-dark underline underline-offset-2">
              {s.name}
            </a>
            <p className="mt-1">{t(s.desc)}</p>
          </li>
        ))}
      </ul>
    </InfoPage>
  );
}
