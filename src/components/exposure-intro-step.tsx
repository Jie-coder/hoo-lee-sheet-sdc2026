// /exposure-intro: the three-row exposure explainer, the Skills Radar card, then one Obsidian CTA to
// /results (Obsidian because the Ember panel is in view) and the source row.
"use client";

import Link from "next/link";
import { RadarEntry } from "@/components/radar-entry";
import { ExposureIntro } from "@/components/exposure-intro";
import { SourceRow } from "@/components/caldera";
import { useT } from "@/lib/i18n";

export function ExposureIntroStep() {
  const { t } = useT();
  return (
    <main className="pb-20">
      <ExposureIntro />
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-12 sm:px-6 md:px-8">
        <RadarEntry size="large" className="mb-10" />
        <div className="flex justify-center">
          <Link
            href="/results"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[16px] font-bold text-card transition-colors hover:bg-ink/90 sm:w-auto"
          >
            {t("exposureIntro.seeResults")}
          </Link>
        </div>
        <SourceRow showDecisionLine={false} className="items-center text-center" sources={[{ label: t("exposure.sourceIlo") }]} />
      </div>
    </main>
  );
}
