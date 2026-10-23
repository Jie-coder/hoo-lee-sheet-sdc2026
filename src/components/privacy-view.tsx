// Privacy page (spec §10). Every statement is verified against code:
// - CV upload: src/app/api/parse-cv/route.ts + src/lib/parse-cv.ts (PDF only, 2 MB,
//   sha256 demo short-circuit, unpdf text extraction, getModel() generateObject;
//   nothing written to disk/DB/logs on this path).
// - Skill mapping: src/lib/skill-match.ts (Gemini embedMany + Supabase match_skills RPC, read-only).
// - Job title estimate: src/lib/exposure-estimate.ts (getModel()).
// - Model choice: src/lib/ai.ts getModel() (Gemini default, Claude Haiku via Replit AI Integrations).
// - Browser storage: src/context/flow-context.tsx (sessionStorage "laluan:flow:v1"),
//   src/lib/i18n.tsx (localStorage "laluan.siteLocale").
// "Delete my data" calls the flow's resetFlow(), which clears the session copy.
"use client";

import { useState } from "react";
import { PageHero } from "@/components/caldera";
import { useFlow } from "@/context/flow-context";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";

const CARDS: ReadonlyArray<{ title: MessageKey; body: MessageKey }> = [
  { title: "privacyPage.readTitle", body: "privacyPage.readBody" },
  { title: "privacyPage.keepTitle", body: "privacyPage.keepBody" },
  { title: "privacyPage.aiTitle", body: "privacyPage.aiCardBody" },
];

const SECTIONS: ReadonlyArray<{ heading: MessageKey; body: MessageKey[] }> = [
  { heading: "privacyPage.cvHeading", body: ["privacyPage.cvBody", "privacyPage.cvDemo", "privacyPage.cvNotStored"] },
  { heading: "privacyPage.aiHeading", body: ["privacyPage.aiBody", "privacyPage.aiTitles"] },
  { heading: "privacyPage.browserHeading", body: ["privacyPage.browserBody"] },
];

export function PrivacyView() {
  const { t } = useT();
  const { resetFlow } = useFlow();
  const [cleared, setCleared] = useState(false);

  return (
    <main className="privacy-page mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-6 md:px-8">
      <PageHero
        className="pt-6 md:pt-10"
        eyebrow={t("privacyPage.title")}
        title={t("privacyPage.heroHeading")}
        lede={t("privacyPage.lede")}
      />

      <section className="mt-16 grid grid-cols-1 gap-4 md:mt-24 md:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.title} className="relative rounded-[40px] bg-paper p-8">
            <h2 className="font-serif text-[30px] leading-[0.95] uppercase md:text-[34px]">{t(card.title)}</h2>
            <p className="mt-4 text-[16px] leading-relaxed">{t(card.body)}</p>
          </div>
        ))}
      </section>

      <article className="mt-24 max-w-[960px] text-[16px] leading-relaxed md:mt-28 md:text-[17px]">
        {SECTIONS.map((section) => (
          <section key={section.heading} className="mt-12 first:mt-0">
            <h2 className="text-[20px] font-bold">{t(section.heading)}</h2>
            {section.body.map((key) => (
              <p key={key} className="mt-3 text-grey">
                {t(key)}
              </p>
            ))}
          </section>
        ))}

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              resetFlow();
              setCleared(true);
            }}
            className="btn-secondary px-5 py-3 text-[15px]"
          >
            {t("privacyPage.deleteData")}
          </button>
          <p role="status" className="text-[14px] text-grey">
            {cleared ? t("privacyPage.deleteDone") : null}
          </p>
        </div>
      </article>
    </main>
  );
}
