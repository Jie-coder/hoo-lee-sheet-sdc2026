// About page. Copy derived from the landing page and the app flow
// (profile -> interview -> results -> pathway).
"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { InfoPage, InfoSection } from "@/components/info-page";

export function AboutView() {
  const { t } = useT();
  return (
    <InfoPage title={t("aboutPage.title")} lede={t("landing.lede")}>
      <InfoSection heading={t("aboutPage.howHeading")}>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>{t("aboutPage.step1")}</li>
          <li>{t("aboutPage.step2")}</li>
          <li>{t("aboutPage.step3")}</li>
          <li>{t("aboutPage.step4")}</li>
        </ol>
      </InfoSection>
      <InfoSection heading={t("aboutPage.limitsHeading")}>
        <p className="mt-2">{t("aboutPage.limitsBody")}</p>
        <p className="mt-3">
          <Link href="/exposure" className="text-sage underline underline-offset-2">{t("aboutPage.exposureLink")}</Link>
        </p>
      </InfoSection>
    </InfoPage>
  );
}
