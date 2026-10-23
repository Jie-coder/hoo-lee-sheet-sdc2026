// AI Exposure intro (design exposure-intro-v3): the Caldera headline pattern,
// then three equal-height cards in a row (stacked on mobile), each with a fixed-aspect illustration panel. The methodology lives in a
// "How exposure is measured" expander on card 03 (spec §4), not inline.
"use client";

import Link from "next/link";
import { FileText, Gauge, Scale } from "lucide-react";
import { PageHero } from "@/components/caldera";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";

const ROWS: ReadonlyArray<{
  n: 1 | 2 | 3;
  panel: "violet" | "ember";
}> = [
  { n: 1, panel: "violet" },
  { n: 2, panel: "ember" },
  { n: 3, panel: "violet" },
];

const ICONS = { 1: FileText, 2: Scale, 3: Gauge } as const;

export function ExposureIntro() {
  const { t } = useT();
  return (
    <section
      className="mx-auto w-full max-w-[1440px] min-w-0 px-4 pt-8 sm:px-6 md:px-8 md:pt-10"
      aria-labelledby="exposure-intro-heading"
    >
      <PageHero
        title={t("exposureIntro.heading")}
        lede={t("exposureIntro.lede")}
        titleClassName="text-[clamp(44px,11vw,56px)] md:text-[clamp(56px,6.5vw,88px)]"
      />
      <div className="mt-12 grid grid-cols-1 items-stretch gap-4 md:mt-16 md:grid-cols-3">
        {ROWS.map(({ n, panel }) => {
          const Icon = ICONS[n];
          return (
            <div
              key={n}
              className="flex h-full min-w-0 flex-col gap-6 rounded-[40px] bg-card p-6 md:p-8"
            >
              <div className="flex flex-1 flex-col justify-start gap-6">
                <span
                  aria-hidden
                  className="flex size-[72px] items-center justify-center rounded-[18px] bg-ink text-card"
                >
                  <Icon className="size-9" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="mb-3.5 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
                    {t(`exposureIntro.step${n}.label` as MessageKey)}
                  </p>
                  <h3 className="mb-4 font-sans text-[26px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance md:text-[28px]">
                    {t(`exposureIntro.step${n}.title` as MessageKey)}
                  </h3>
                  <p className="text-grey">
                    {t(`exposureIntro.step${n}.body` as MessageKey)}
                  </p>
                  {n === 3 && (
                    <details className="group mt-6">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border-[1.5px] border-ink px-[22px] py-3 text-[15px] font-bold text-ink hover:bg-ink hover:text-card">
                        {t("exposureIntro.measuredExpandTitle")}
                        <span
                          aria-hidden
                          className="text-[12px] transition-transform group-open:rotate-90"
                        >
                          ▸
                        </span>
                      </summary>
                      <div className="mt-4 space-y-3 border-t-[1.5px] border-dashed border-ink/25 pt-4 text-[14px] leading-relaxed text-grey">
                        <p>{t("exposurePage.whatBody")}</p>
                        <p>{t("exposurePage.howCatalogue")}</p>
                        <p>{t("exposurePage.howMatch")}</p>
                        <Link
                          href="/data-sources"
                          className="inline-block font-mono text-[12px] tracking-[0.04em] text-sage-dark uppercase hover:underline"
                        >
                          {t("exposureIntro.dataSourcesLink")} →
                        </Link>
                      </div>
                    </details>
                  )}
                </div>
              </div>
              <div
                className={`aspect-[820/520] w-full shrink-0 overflow-hidden rounded-[28px] ${panel === "ember" ? "bg-sage" : "bg-plasma"}`}
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static decorative illustration */}
                <img
                  src={`/exposure/u${n}.svg`}
                  alt=""
                  className="size-full object-contain object-center p-6"
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <p className="text-center font-mono text-[13px] leading-relaxed text-grey">
          {t("exposureIntro.notJobLoss")}{" "}
          <a
            href="https://www.ilo.org/sites/default/files/2025-05/WP140_web.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sage underline-offset-2 hover:underline"
          >
            {t("exposureIntro.sourceLink")} ↗
          </a>
        </p>
      </div>
    </section>
  );
}
