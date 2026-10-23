// Data sources page. Lists only sources actually referenced in repo data/code:
// data/sources.csv + src/data/catalogue.json (ILO, ESCO, OpenDOSM, WEF, arXiv)
// and data/salary_by_role.csv / src/data/salary-by-role.json (JobStreet, DOSM).
"use client";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";
import { InfoPage } from "@/components/info-page";

export const DATA_SOURCES: ReadonlyArray<{ name: string; url: string; desc: MessageKey }> = [
  { name: "ILO: Generative AI and Jobs (2025 refined global index, WP140)", url: "https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf", desc: "sourcesPage.ilo" },
  { name: "ESCO (European Skills, Competences, Qualifications and Occupations)", url: "https://esco.ec.europa.eu/en/use-esco/use-esco-services-api", desc: "sourcesPage.esco" },
  { name: "OpenDOSM: Salaries & Wages by Occupation", url: "https://open.dosm.gov.my/data-catalogue/wages_occupation", desc: "sourcesPage.dosmWages" },
  { name: "OpenDOSM: Labour Force Survey (monthly)", url: "https://open.dosm.gov.my/data-catalogue/lfs_month_sa", desc: "sourcesPage.dosmLfs" },
  { name: "JobStreet Malaysia career advice: salary pages", url: "https://my.jobstreet.com/career-advice", desc: "sourcesPage.jobstreet" },
  { name: "WEF Future of Jobs Report 2025", url: "https://reports.weforum.org/docs/WEF_Future_of_Jobs_Report_2025.pdf", desc: "sourcesPage.wefJobs" },
  { name: "WEF Four Futures for Jobs in the New Economy: AI and Talent in 2030", url: "https://reports.weforum.org/docs/WEF_Four_Futures_for_Jobs_in_the_New_Economy_AI_and_Talent_in_2030_2025.pdf", desc: "sourcesPage.wefFutures" },
  { name: "arXiv API", url: "https://arxiv.org/help/api/index", desc: "sourcesPage.arxiv" },
];

export function DataSourcesView() {
  const { t } = useT();
  return (
    <InfoPage title={t("sourcesPage.title")} lede={t("sourcesPage.lede")}>
      <ul className="mt-10 space-y-6">
        {DATA_SOURCES.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sage underline underline-offset-2">
              {s.name}
            </a>
            <p className="mt-1">{t(s.desc)}</p>
          </li>
        ))}
      </ul>
    </InfoPage>
  );
}
