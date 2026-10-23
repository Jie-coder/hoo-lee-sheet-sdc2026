// /exposure (full page): what the AI exposure score on role cards means, in the
// Caldera system — the headline pattern, a signal-light legend beside the meter
// illustration, and the methodology behind expanders (not an inline wall). The
// 0.33 / 0.66 bands mirror SCORE_BAND_THRESHOLDS (src/types/contracts.ts); the
// matching logic in howMatch mirrors the role alias table + AI pick.
"use client";

import { RadarEntry } from "@/components/radar-entry";
import Link from "next/link";
import { IllustrationPanel, PageHero, Perforation, SignalLight, SourceRow } from "@/components/caldera";
import { CATALOGUE, SOURCE_NAMES } from "@/lib/catalogue";
import { useT, type MessageKey } from "@/lib/i18n";

function sourceUrl(name: string): string | undefined {
  return CATALOGUE.sources[name]?.url;
}

const LIGHTS: ReadonlyArray<{ level: "low" | "medium" | "high"; label: MessageKey }> = [
  { level: "low", label: "exposure.lightLow" },
  { level: "medium", label: "exposure.lightMedium" },
  { level: "high", label: "exposure.lightHigh" },
];

function Expander({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group border-b-[1.5px] border-dashed border-ink/20 py-5 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-sans text-[18px] font-bold">
        {summary}
        <span aria-hidden className="shrink-0 font-mono text-[12px] text-grey transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-grey">{children}</div>
    </details>
  );
}

export function ExposureView() {
  const { t } = useT();
  const sources = [
    { name: SOURCE_NAMES.exposure, desc: t("exposurePage.sourceIloDesc") },
    { name: SOURCE_NAMES.skills, desc: t("exposurePage.sourceEscoDesc") },
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 sm:px-6 md:px-8">
      <PageHero
        className="pt-6 md:pt-10"
        eyebrow={t("exposurePage.metaTitle")}
        title={t("exposurePage.title")}
        lede={t("exposurePage.lede")}
        titleClassName="text-[clamp(40px,10vw,56px)] md:text-[clamp(56px,6.5vw,96px)]"
      />

      {/* Signal-light legend | meter illustration */}
      <section className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 rounded-[40px] bg-card p-8 md:p-10">
          <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("exposurePage.whatHeading")}</p>
          <div>
            <p className="mb-6 text-[16px] leading-relaxed">{t("exposurePage.whatBody")}</p>
            <ul className="space-y-3 text-[18px] font-bold">
              {LIGHTS.map((light) => (
                <li key={light.level}>
                  <SignalLight level={light.level} size={18} label={t(light.label)} className="gap-3" />
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[15px] leading-relaxed text-grey">{t("exposurePage.bandsBody")}</p>
          </div>
        </div>
        <IllustrationPanel src="/illustrations/u3.svg" panel="plasma" className="h-[220px] md:h-auto md:min-h-[360px]" />
      </section>

      {/* Scales illustration | methodology expanders */}
      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <IllustrationPanel
          src="/illustrations/u2.svg"
          panel="ember"
          className="order-2 h-[220px] md:order-1 md:h-auto md:min-h-[360px]"
        />
        <div className="order-1 rounded-[40px] bg-card p-8 md:order-2 md:p-10">
          <Expander summary={t("exposurePage.howHeading")}>
            <p>{t("exposurePage.howCatalogue")}</p>
            <p>{t("exposurePage.howMatch")}</p>
            <p>{t("exposurePage.howStatuses")}</p>
          </Expander>
          <Expander summary={t("exposurePage.sourcesHeading")}>
            <ul className="space-y-3">
              {sources.map((source) => {
                const url = sourceUrl(source.name);
                return (
                  <li key={source.name}>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="font-bold text-ink underline underline-offset-4">
                        {source.name}
                      </a>
                    ) : (
                      <span className="font-bold text-ink">{source.name}</span>
                    )}
                    <span>: {source.desc}</span>
                  </li>
                );
              })}
            </ul>
            <Perforation className="mt-4" />
            <Link
              href="/data-sources"
              className="mt-4 inline-block font-mono text-[12px] tracking-[0.04em] text-sage-dark uppercase hover:underline"
            >
              {t("exposureIntro.dataSourcesLink")} →
            </Link>
          </Expander>
        </div>
      </section>

      <SourceRow
        className="mt-12"
        sources={[{ label: t("exposure.sourceIlo") }, { label: SOURCE_NAMES.skills }]}
      />

      <RadarEntry size="large" className="mt-16" />
    </main>
  );
}
