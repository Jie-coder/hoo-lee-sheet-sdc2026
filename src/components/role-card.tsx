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
import { isStretchRoute } from "@/lib/scoring";
import { formatFitPercent, missingValue } from "@/lib/display";
import { useT, type MessageKey } from "@/lib/i18n";
import type { RoleBreakdown } from "@/lib/analyze";
import { formatMonthlyRange, formatMonthlyRm, hasRealRange, salaryForRole } from "@/lib/salary";
import { cn } from "@/lib/utils";
import { scoreBand, type RoleResult, type ScenarioId } from "@/types/contracts";

const EXPOSURE_LABEL: Record<"low" | "medium" | "high", MessageKey> = {
  low: "exposure.lightLow",
  medium: "exposure.lightMedium",
  high: "exposure.lightHigh",
};

const SCORE_COMPONENTS = [
  { key: "fit", label: "results.component.fit" },
  { key: "trend", label: "results.component.trend" },
  { key: "demand", label: "results.component.demand" },
  { key: "exposure", label: "results.component.exposure" },
  { key: "sdg", label: "results.component.sdg" },
] as const satisfies readonly { key: "fit" | "trend" | "demand" | "exposure" | "sdg"; label: MessageKey }[];

function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}`;
}

const SKILLS_COLLAPSED = 3;

export function RoleCard({
  role,
  rank,
  total,
  targetLabels,
  chosen,
  onChoose,
  isPrimary,
  relatedSkills = [],
  sdgMatch = false,
  displayFit,
  breakdown,
  scenario = "co",
}: {
  role: RoleResult;
  rank: number;
  total: number;
  targetLabels: Readonly<Record<string, string>>;
  chosen: boolean;
  onChoose: (role: RoleResult) => void;
  /** Ticket 01 only: the single Ember CTA on the page. */
  isPrimary: boolean;
  /** Essential skills that earned half credit from a related skill the user has. */
  relatedSkills?: readonly string[];
  /** The role's SDG mapping matches the user's chosen impact interest (ranking bonus applied). */
  sdgMatch?: boolean;
  /** Displayed Fit (skill fit + INTEREST_FIT_BONUS when the role matches the SDG choice). Defaults to raw skill fit. */
  displayFit?: number;
  /** Score components, trend momentum and what-if items for the drawer. */
  breakdown?: RoleBreakdown;
  /** Which scenario's score breakdown to show. */
  scenario?: ScenarioId;
}) {
  const reduce = useReducedMotion();
  const { t } = useT();
  const [whyOpen, setWhyOpen] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);

  const shownFit = displayFit ?? role.fit;
  // Headline Fit is the calibrated value (raw fit / the fixed global
  // denominator, see calibrateFit in lib/score-breakdown.ts), so the score is
  // comparable across users. Raw fit stays visible in the rank line and drawer.
  const headlineFit = breakdown ? breakdown.calibratedFit : shownFit;
  const fitPercent = Math.round(headlineFit * 100);
  // Transition route stays on raw skill fit, not the interest-blended Fit.
  const stretch = isStretchRoute(role.fit);
  const interestPart = shownFit - role.fit;
  const fitBreakdown =
    interestPart > 0
      ? t("results.fitBreakdownInterest", { skill: formatFitPercent(role.fit), interest: formatFitPercent(interestPart) })
      : t("results.fitBreakdownSkill", { skill: formatFitPercent(role.fit) });
  const tone = scoreBand(role.exposure);
  const topSdg = role.sdg[0];
  const salary = salaryForRole(role.occupationId);
  const visibleSkills = skillsExpanded ? role.gap : role.gap.slice(0, SKILLS_COLLAPSED);
  const extraSkillCount = role.gap.length - SKILLS_COLLAPSED;
  const scenarioScore = breakdown?.score[scenario];
  const trendSkills = scenarioScore
    ? [...scenarioScore.skills]
        .filter((skill) => skill.momentumContribution !== 0)
        .sort((a, b) => Math.abs(b.momentumContribution) - Math.abs(a.momentumContribution))
        .slice(0, 5)
    : [];

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
          <span className="font-serif text-[56px] leading-none tabular-nums">{formatFitPercent(headlineFit)}</span>
          <span className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.fit")}</span>
        </div>
        {scenarioScore && (
          <p className="mt-2 font-mono text-[12px] tracking-[0.06em] text-ink uppercase tabular-nums">
            {t("results.rankScoreLine", { score: (scenarioScore.total * 100).toFixed(1) })}
          </p>
        )}
        {breakdown && (
          <p className="mt-1 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
            {t("results.fitRank", {
              rank: String(breakdown.fitRank.rank),
              total: String(breakdown.fitRank.total),
              raw: formatFitPercent(role.fit),
            })}
          </p>
        )}
        {sdgMatch && (
          <p className="mt-2 font-mono text-[11px] tracking-[0.04em] text-sage-dark uppercase">{t("results.sdgMatch")}</p>
        )}
        {stretch && (
          <p className="mt-2 font-mono text-[11px] tracking-[0.04em] text-grey uppercase" title={t("results.stretchHint")}>
            {t("results.stretchRoute")}
          </p>
        )}
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

        <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.fit")}</p>
        <p className="mt-2.5 mb-6 text-[15px] leading-relaxed">{fitBreakdown}</p>

        {breakdown && scenarioScore && (
          <>
            <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.scoreBreakdown")}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-grey">{t("results.scoreEstimateNote")}</p>
            <ul className="mt-2.5 space-y-1.5 text-[15px]">
              {SCORE_COMPONENTS.map((row) => {
                const component = scenarioScore.components[row.key];
                const value =
                  row.key === "sdg"
                    ? component.value === 1
                      ? t("results.sdgYes")
                      : t("results.sdgNo")
                    : row.key === "trend"
                      ? t("results.trendMomentum", { momentum: component.value.toFixed(2) })
                      : `${(component.value * 100).toFixed(0)}%`;
                return (
                  <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>{t(row.label)}</span>
                    <span className="font-mono text-[12px] tracking-[0.04em] text-grey tabular-nums">
                      {value} · × {component.weight} · {(component.points * 100).toFixed(1)}
                    </span>
                  </li>
                );
              })}
              <li className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-ink/10 pt-1.5">
                <span>{t("results.component.total")}</span>
                <span className="font-mono text-[12px] tracking-[0.04em] text-grey tabular-nums">
                  {(scenarioScore.total * 100).toFixed(1)}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[15px] leading-relaxed">
              {t("results.calibratedFit", { calibrated: formatFitPercent(breakdown.calibratedFit) })}
            </p>

            <p className="mt-6 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
              {t("results.trendBoost")}
            </p>
            {trendSkills.length === 0 && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-grey">{t("results.trendBoostNone")}</p>
            )}
            {trendSkills.length > 0 && (
              <>
                <ul className="mt-2.5 space-y-1.5 text-[15px]">
                  {trendSkills.map((skill) => (
                    <li key={skill.skillId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span>{skill.label}</span>
                      <span className="font-mono text-[12px] tracking-[0.04em] text-grey tabular-nums">
                        {signedPercent(skill.momentumContribution)} {t("results.trendBoostUnit")}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {breakdown.whatIf.length > 0 && (
              <>
                <p className="mt-6 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
                  {t("results.whatIfTitle")}
                </p>
                <ul className="mt-2.5 space-y-1.5 text-[15px]">
                  {breakdown.whatIf.map((item) => (
                    <li key={item.skillId}>
                      {t("results.whatIfItem", { skill: item.label, points: `+${item.deltaPoints.toFixed(1)}` })}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[14px] leading-relaxed text-grey">{t("results.whatIfNote")}</p>
              </>
            )}
          </>
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

        {stretch && <p className="mt-4 text-[14px] leading-relaxed text-grey">{t("results.stretchHint")}</p>}

        {relatedSkills.length > 0 && (
          <>
            <p className="mt-6 font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("results.relatedSkills")}</p>
            <ul className="mt-2.5 space-y-1.5 text-[15px]">
              {relatedSkills.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
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
