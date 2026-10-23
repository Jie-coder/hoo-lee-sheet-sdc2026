// AI Exposure intro (design exposure-intro-v3): the Caldera headline pattern,
// then three alternating card + illustration rows. The methodology lives in a
// "How exposure is measured" expander on card 03 (spec §4), not inline.
"use client";

import Link from "next/link";
import { PageHero } from "@/components/caldera";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";

const ROWS: ReadonlyArray<{
  n: 1 | 2 | 3;
  panel: "violet" | "ember";
  mirrored: boolean;
}> = [
  { n: 1, panel: "violet", mirrored: false },
  { n: 2, panel: "ember", mirrored: true },
  { n: 3, panel: "violet", mirrored: false },
];

export function ExposureIntro() {
  const { t } = useT();
  return (
    <section className="mx-auto w-full max-w-[1440px] min-w-0 px-4 pt-8 sm:px-6 md:px-8 md:pt-10" aria-labelledby="exposure-intro-heading">
      <PageHero
        title={t("exposureIntro.heading")}
        lede={t("exposureIntro.lede")}
        titleClassName="text-[clamp(44px,11vw,56px)] md:text-[clamp(56px,6.5vw,88px)]"
      />
      <div className="mt-12 flex flex-col gap-4 md:mt-16">
        {ROWS.map(({ n, panel, mirrored }) => (
          <div
            key={n}
            className={`flex flex-col gap-4 md:h-[520px] ${mirrored ? "md:flex-row-reverse" : "md:flex-row"}`}
          >
            <div className="flex flex-col justify-between gap-8 rounded-[40px] bg-card p-8 md:w-[44%] md:shrink-0 md:p-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative icon */}
              <img src={`/exposure/ic${n}.svg`} alt="" aria-hidden className="size-[72px] rounded-[18px] bg-ink p-3" />
              <div>
                <p className="mb-3.5 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
                  {t(`exposureIntro.step${n}.label` as MessageKey)}
                </p>
                <h3 className="mb-4 font-sans text-[26px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance md:text-[28px]">
                  {t(`exposureIntro.step${n}.title` as MessageKey)}
                </h3>
                <p className="text-grey">{t(`exposureIntro.step${n}.body` as MessageKey)}</p>
                {n === 3 && (
                  <details className="group mt-6">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border-[1.5px] border-ink px-[22px] py-3 text-[15px] font-bold text-ink hover:bg-ink hover:text-card">
                      {t("exposureIntro.measuredExpandTitle")}
                      <span aria-hidden className="text-[12px] transition-transform group-open:rotate-90">▸</span>
                    </summary>
                    <div className="mt-4 space-y-3 border-t-[1.5px] border-dashed border-ink/25 pt-4 text-[14px] leading-relaxed text-grey">
                      <p>{t("exposurePage.whatBody")}</p>
                      <p>{t("exposurePage.howCatalogue")}</p>
                      <p>{t("exposurePage.howMatch")}</p>
                      <Link href="/data-sources" className="inline-block font-mono text-[12px] tracking-[0.04em] text-sage-dark uppercase hover:underline">
                        {t("exposureIntro.dataSourcesLink")} →
                      </Link>
                    </div>
                  </details>
                )}
              </div>
            </div>
            <div
              className={`aspect-[820/520] overflow-hidden rounded-[40px] md:aspect-auto md:min-w-0 md:flex-1 ${panel === "ember" ? "bg-sage" : "bg-plasma"}`}
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative illustration */}
              <img src={`/exposure/u${n}.svg`} alt="" className="size-full object-cover" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
