// Explanation page for the AI exposure score. Text only, plus one signal-light
// legend. Thresholds and the 0.80 match cut-off mirror SCORE_BAND_THRESHOLDS
// (src/types/contracts.ts) and EXPOSURE_MATCH_THRESHOLD (src/lib/exposure-estimate.ts).
"use client";

import { ExposureIntro } from "@/components/exposure-intro";
import { SignalLight } from "@/components/role-exposure";
import { useT } from "@/lib/i18n";
import { CATALOGUE, SOURCE_NAMES } from "@/lib/catalogue";

function sourceUrl(name: string): string | undefined {
  return CATALOGUE.sources[name]?.url;
}

export function ExposureView() {
  const { t } = useT();
  const sources = [
    { name: SOURCE_NAMES.exposure, desc: t("exposurePage.sourceIloDesc") },
    { name: SOURCE_NAMES.skills, desc: t("exposurePage.sourceEscoDesc") },
  ];
  return (
    <>
      <ExposureIntro />
      <article className="mx-auto w-full max-w-[680px] px-5 pt-24 pb-12 text-[15px] leading-relaxed">
        <h1 className="font-serif text-[34px] leading-tight font-medium tracking-tight">
          {t("exposurePage.title")}
        </h1>
        <p className="mt-3 text-grey">{t("exposurePage.lede")}</p>

        <section className="mt-10">
          <h2 className="font-serif text-[22px] font-medium">
            {t("exposurePage.whatHeading")}
          </h2>
          <p className="mt-2">{t("exposurePage.whatBody")}</p>
          <div
            className="mt-4 flex flex-wrap items-center gap-4 text-[13px] text-grey"
            aria-hidden
          >
            <span className="inline-flex items-center gap-1.5">
              <SignalLight tone="low" />
              {t("exposure.lightLow")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SignalLight tone="medium" />
              {t("exposure.lightMedium")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SignalLight tone="high" />
              {t("exposure.lightHigh")}
            </span>
          </div>
          <p className="mt-3">{t("exposurePage.bandsBody")}</p>
        </section>

        <section id="how-measured" className="mt-10 scroll-mt-24">
          <h2 className="font-serif text-[22px] font-medium">
            {t("exposurePage.howHeading")}
          </h2>
          <p className="mt-2">{t("exposurePage.howCatalogue")}</p>
          <p className="mt-3">{t("exposurePage.howMatch")}</p>
          <p className="mt-3">{t("exposurePage.howStatuses")}</p>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-[22px] font-medium">
            {t("exposurePage.sourcesHeading")}
          </h2>
          <ul className="mt-2 space-y-3">
            {sources.map((source) => {
              const url = sourceUrl(source.name);
              return (
                <li key={source.name}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline underline-offset-4"
                    >
                      {source.name}
                    </a>
                  ) : (
                    <span className="font-medium">{source.name}</span>
                  )}
                  <span className="text-grey">: {source.desc}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-12 border-t border-line pt-4 text-[13px] text-grey">
          {t("exposurePage.estimatesNote")}
        </p>
      </article>
    </>
  );
}
