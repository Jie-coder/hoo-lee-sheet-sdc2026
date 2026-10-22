// Legend for the three SDG tiers. Shown beside the first role-card row.
"use client";

import { useT } from "@/lib/i18n";

export function SdgLegend() {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-grey">
      <span>{t("sdgLegend.title")}</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded bg-sage" />
        {t("sdgLegend.direct")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded border border-sage" />
        {t("sdgLegend.supporting")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded border border-dashed border-sage" />
        {t("sdgLegend.inferred")}
      </span>
    </div>
  );
}
