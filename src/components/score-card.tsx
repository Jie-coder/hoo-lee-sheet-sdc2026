// Current-work block: the AI exposure of the user's current job, from the
// ILO GenAI exposure study. "Exposure is not job loss." always stays visible.
// Augmentation is not shown: there is no task-level augmentation data yet.
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp, EASE_OUT } from "@/components/motion";
import { InfoPopover } from "@/components/ui/info-popover";
import { SourcesDisclosure } from "@/components/sources-disclosure";
import { bandMessageKey } from "@/lib/display";
import { useT } from "@/lib/i18n";
import type { Source } from "@/types/contracts";

export type CurrentWork = {
  title: string;
  exposure: number;
  /** ISCO-08 has no code for this exact job, so the figure is for a wider occupation group. */
  groupEstimate: boolean;
  sources: Source[];
};

export function ScoreCard({ currentWork }: { currentWork: CurrentWork }) {
  const reduce = useReducedMotion();
  const { t } = useT();
  const bandKey = bandMessageKey(currentWork.exposure);
  const exposurePercent = Math.round(currentWork.exposure * 100);

  return (
    <section className="grid grid-cols-1 gap-8 border-y border-line py-8 md:grid-cols-12 md:items-center">
      <div className="md:col-span-5">
        <div className="flex items-center gap-1.5 text-[13px] text-grey">
          {t("scoreCard.exposureLabel")}
          <InfoPopover label={t("scoreCard.exposureInfoLabel")}>{t("scoreCard.exposureInfoBody")}</InfoPopover>
        </div>
        <p className="mt-2 font-serif text-[52px] leading-none font-medium tracking-tight sm:text-[64px]">
          {t(bandKey)}{" "}
          <span className="text-[32px] text-grey/60 sm:text-[40px]">
            <CountUp value={currentWork.exposure} decimals={2} />
          </span>
        </p>
        <p className="mt-3 text-[15px] font-medium">{t("scoreCard.notJobLoss")}</p>
      </div>

      <div className="md:col-span-7">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-alt">
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full bg-sage"
            initial={reduce ? { width: `${exposurePercent}%` } : { width: 0 }}
            animate={{ width: `${exposurePercent}%` }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.2 }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-grey">
          <span>{t("scoreCard.low")}</span>
          <span>{t("scoreCard.medium")}</span>
          <span>{t("scoreCard.high")}</span>
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-grey">
          {t("scoreCard.forRolePrefix")}
          <span className="font-medium text-ink capitalize">{currentWork.title}</span>
          {currentWork.groupEstimate ? t("scoreCard.forRoleGroupSuffix") : t("scoreCard.forRoleSuffix")}{" "}
          {t("scoreCard.exposureExplanation")}
        </p>
        <div className="mt-3">
          <SourcesDisclosure sources={currentWork.sources} />
        </div>
      </div>
    </section>
  );
}
