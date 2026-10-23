// Privacy page. Every statement is verified against code:
// - CV upload: src/app/api/parse-cv/route.ts + src/lib/parse-cv.ts (PDF only, 2 MB,
//   sha256 demo short-circuit, unpdf text extraction, getModel() generateObject;
//   nothing written to disk/DB/logs on this path).
// - Skill mapping: src/lib/skill-match.ts (Gemini embedMany + Supabase match_skills RPC, read-only).
// - Job title estimate: src/lib/exposure-estimate.ts (getModel()).
// - Model choice: src/lib/ai.ts getModel() (Gemini default, Claude Haiku via Replit AI Integrations).
// - Browser storage: src/context/flow-context.tsx (sessionStorage "laluan:flow:v1"),
//   src/lib/i18n.tsx (localStorage "laluan.siteLocale").
"use client";

import { useT } from "@/lib/i18n";
import { InfoPage, InfoSection } from "@/components/info-page";

export function PrivacyView() {
  const { t } = useT();
  return (
    <InfoPage title={t("privacyPage.title")} lede={t("privacyPage.lede")}>
      <InfoSection heading={t("privacyPage.cvHeading")}>
        <p className="mt-2">{t("privacyPage.cvBody")}</p>
        <p className="mt-3">{t("privacyPage.cvDemo")}</p>
        <p className="mt-3">{t("privacyPage.cvNotStored")}</p>
      </InfoSection>
      <InfoSection heading={t("privacyPage.aiHeading")}>
        <p className="mt-2">{t("privacyPage.aiBody")}</p>
        <p className="mt-3">{t("privacyPage.aiTitles")}</p>
      </InfoSection>
      <InfoSection heading={t("privacyPage.browserHeading")}>
        <p className="mt-2">{t("privacyPage.browserBody")}</p>
      </InfoSection>
    </InfoPage>
  );
}
