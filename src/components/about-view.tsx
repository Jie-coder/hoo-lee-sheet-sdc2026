// About (spec §8): Caldera hero, an Ember rail-switch illustration beside the
// mission card with SDG 4 / 8 / 10 chips, three principle cards, mono credits.
"use client";

import { IllustrationPanel, PageHero, SdgChip } from "@/components/caldera";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";

const PRINCIPLES: ReadonlyArray<{ title: MessageKey; body: MessageKey }> = [
  { title: "aboutPage.principle1Title", body: "aboutPage.principle1Body" },
  { title: "aboutPage.principle2Title", body: "aboutPage.principle2Body" },
  { title: "aboutPage.principle3Title", body: "aboutPage.principle3Body" },
];

const SDGS: ReadonlyArray<MessageKey> = ["aboutPage.sdg4", "aboutPage.sdg8", "aboutPage.sdg10"];

export function AboutView() {
  const { t } = useT();
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-6 md:px-8">
      <PageHero
        className="pt-6 md:pt-10"
        eyebrow={t("aboutPage.title")}
        title={t("aboutPage.heroHeading")}
        lede={t("aboutPage.lede")}
      />

      <section className="mt-16 grid grid-cols-1 gap-4 md:mt-24 md:grid-cols-2">
        <IllustrationPanel
          src="/illustrations/about-rail-switch.svg"
          panel="ember"
          alt={t("aboutPage.illustrationAlt")}
          className="h-[240px] md:h-auto md:min-h-[380px]"
        />
        <div className="flex flex-col justify-between gap-8 rounded-[40px] bg-card p-8 md:p-10">
          <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("aboutPage.missionLabel")}</p>
          <div>
            <p className="text-[20px] leading-[1.4] font-medium text-balance md:text-[24px]">{t("aboutPage.missionBody")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SDGS.map((key) => (
                <SdgChip key={key}>{t(key)}</SdgChip>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-24 md:mt-28" aria-label={t("aboutPage.principlesLabel")}>
        <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("aboutPage.principlesLabel")}</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRINCIPLES.map((principle, index) => (
            <div key={principle.title} className="rounded-[40px] bg-card p-8">
              <p className="font-mono text-[12px] tracking-[0.06em] text-sage-dark uppercase">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-4 font-serif text-[32px] leading-[0.95] uppercase md:text-[36px]">{t(principle.title)}</h2>
              <p className="mt-4 text-[16px] leading-relaxed">{t(principle.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-16 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
        {t("aboutPage.creditsLabel")} · {t("aboutPage.credits")}
      </p>
    </main>
  );
}
