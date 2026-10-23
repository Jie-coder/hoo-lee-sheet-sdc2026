// /exposure-intro: the three-row exposure explainer, then one CTA to /results.
// Client-side navigation keeps the flow state (profile + interview answers).
"use client";

import Link from "next/link";
import { ExposureIntro } from "@/components/exposure-intro";
import { useT } from "@/lib/i18n";

export function ExposureIntroStep() {
  const { t } = useT();
  return (
    <main>
      <ExposureIntro measuredHref="/exposure#how-measured" />
      <div className="mx-auto flex w-full max-w-6xl justify-center px-5 pt-12 pb-20 md:justify-end">
        <Link href="/results" className="btn-primary w-full justify-center px-6 py-3 text-[16px] sm:w-auto">
          {t("exposureIntro.seeResults")}
        </Link>
      </div>
    </main>
  );
}
