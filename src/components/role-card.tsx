// One role ticket (spec §5): a Limestone ticket with notches at the perforation
// line, an exposure signal light, an Anton title and fit %, the salary range and
// one SDG chip. Only ticket 01 gets the Ember CTA; the rest use outline pills and
// a "Why" button that opens a drawer (robust badge, skills to build, demand, sources).
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Drawer, Perforation, SdgChip, SignalLight, Ticket } from "@/components/caldera";
import { EASE_OUT } from "@/components/motion";
import { SourcesDisclosure } from "@/components/sources-disclosure";
import { formatFitPercent, missingValue } from "@/lib/display";
import { useT, type MessageKey } from "@/lib/i18n";
import { formatMonthlyRange, formatMonthlyRm, hasRealRange, salaryForRole } from "@/lib/salary";
import { cn } from "@/lib/utils";
import { scoreBand, type RoleResult } from "@/types/contracts";

const EXPOSURE_LABEL: Record<"low" | "medium" | "high", MessageKey> = {
  low: "exposure.lightLow",
  medium: "exposure.lightMedium",
  high: "exposure.lightHigh",
};

const SKILLS_COLLAPSED = 3;

export function RoleCard({
  role,
  rank,
  total,
  targetLabels,
  chosen,
  onChoose,
  isPrimary,
}: {
  role: RoleResult;
  rank: number;
  total: number;
  targetLabels: Readonly<Record<string, string>>;
  chosen: boolean;
  onChoose: (role: RoleResult) => void;
  /** Ticket 01 only: the single Ember CTA on the page. */
  isPrimary: boolean;
}) {
  const reduce = useReducedMotion();
  const { t } = useT();
  const [whyOpen, setWhyOpen] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);

  const fitPercent = Math.round(role.fit * 100);
  const tone = scoreBand(role.exposure);
  const topSdg = role.sdg[0];
  const salary = salaryForRole(role.occupationId);
  const visibleSkills = skillsExpanded ? role.gap : role.gap.slice(0, SKILLS_COLLAPSED);
  const extraSkillCount = role.gap.length - SKILLS_COLLAPSED;

  return (
    <motion.div
      layout
      className="h-full"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { layout: { duration: 0.3, ease: EASE_OUT }, duration: 0.45, ease: EASE_OUT }}
    >
      <Ticket notch notchTop="58%" className="flex h-full flex-col p-7 sm:p-9">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
            {t("results.ticketLabel", { rank: String(rank), total: String(total) })}
          </span>
          <SignalLight level={tone} size={18} label={<span className="sr-only">{t(EXPOSURE_LABEL[tone])}</span>} />
        </div>

        <h3 className="mt-10 min-h-[1.9em] font-serif text-[clamp(32px,7vw,44px)] leading-[0.95] uppercase">
          {role.title}
        </h3>

        <div className="mt-5 flex items-baseline gap-2.5">
          <span className="font-serif text-[56px] leading-none tabular-nums">{formatFitPercent(role.fit)}</span>
          <span className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.skillFit")}</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-paper">
          <motion.div
            className="h-full rounded-full bg-ink"
            initial={reduce ? { width: `${fitPercent}%` } : { width: 0 }}
            animate={{ width: `${fitPercent}%` }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.25 }}
          />
        </div>

        <Perforation className="my-7" />

        <div className="min-h-[2.75rem]">
          {salary && hasRealRange(salary) ? (
            <>
              <p className="font-sans text-[20px] font-bold tabular-nums">
                {formatMonthlyRange(salary.minMonthlyRm, salary.maxMonthlyRm)}
              </p>
              <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-grey uppercase">
                {t("salary.perMonth")} ·{" "}
                <a href={salary.rangeSourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {salary.rangeSourceRole && salary.rangeSourceRole.toLowerCase() !== role.title.toLowerCase()
                    ? t("salary.sourceWithRole", { source: salary.rangeSourceName, role: salary.rangeSourceRole, year: String(salary.rangeYear) })
                    : t("salary.source", { source: salary.rangeSourceName, year: String(salary.rangeYear) })}
                </a>{" "}
                · {t("salary.estimate")}
              </p>
            </>
          ) : salary ? (
            <>
              <p className="font-sans text-[20px] font-bold tabular-nums">{formatMonthlyRm(salary.avgMonthlyRm)}</p>
              <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-grey uppercase">
                {t("salary.perMonth")} · {t("salary.dosmMajorGroup", { year: String(salary.year) })}
              </p>
            </>
          ) : (
            <p className="font-sans text-[20px] font-bold text-grey">{missingValue(t("common.notAvailable"))}</p>
          )}
        </div>

        <div className="mt-5">
          <SdgChip>{`SDG ${topSdg.target} ${targetLabels[topSdg.target] ?? topSdg.target}`.trim()}</SdgChip>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-7">
          <button
            type="button"
            aria-pressed={chosen}
            onClick={() => onChoose(role)}
            className={cn(
              "inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-bold transition-colors",
              isPrimary
                ? "bg-sage text-ink hover:bg-sage/90"
                : "border-[1.5px] border-ink text-ink hover:bg-ink hover:text-paper",
            )}
          >
            {chosen ? t("results.chosenRoute") : `${t("results.chooseRoute")} →`}
          </button>
          <button
            type="button"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen(true)}
            className="inline-flex items-center justify-center rounded-full border-[1.5px] border-ink/30 px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:border-ink"
          >
            {t("results.why")}
          </button>
        </div>
      </Ticket>

      <Drawer open={whyOpen} onClose={() => setWhyOpen(false)} title={role.title}>
        {role.robust && (
          <SdgChip className="mb-5 bg-sulfur normal-case">{t("results.robustBadge")}</SdgChip>
        )}

        <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.skillsToBuild")}</p>
        <ul className="mt-2.5 space-y-1.5 text-[15px]">
          {visibleSkills.map((skill) => (
            <li key={skill.skillId}>{skill.label}</li>
          ))}
        </ul>
        {extraSkillCount > 0 && (
          <button
            type="button"
            aria-expanded={skillsExpanded}
            onClick={() => setSkillsExpanded((current) => !current)}
            className="mt-2 font-mono text-[12px] tracking-[0.04em] text-sage-dark uppercase hover:underline"
          >
            {skillsExpanded ? t("roleCard.showLess") : t("roleCard.more", { count: String(extraSkillCount) })}
          </button>
        )}

        {role.explanation && (
          <>
            <Perforation className="my-6" />
            <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.inDemand")}</p>
            <p className="mt-2.5 text-[15px] leading-relaxed text-grey">{role.explanation}</p>
          </>
        )}

        <Perforation className="my-6" />
        <SourcesDisclosure sources={role.sources} />
      </Drawer>
    </motion.div>
  );
}
