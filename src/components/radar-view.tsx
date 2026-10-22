// Future Skills Radar view: rising / falling skills with the arXiv counts
// behind each one, the roles they touch, and the same date pill as /results.
// Redesign language: few words, details in popovers, staggered motion.
"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { EstimateFooter } from "@/components/estimate-footer";
import { EASE_OUT, Stagger, StaggerItem } from "@/components/motion";
import { SignalDateToggle } from "@/components/signal-date-toggle";
import { InfoPopover } from "@/components/ui/info-popover";
import type { SignalDate } from "@/lib/analyze";
import type { CatalogueKeyword } from "@/lib/catalogue";
import { formatDayMonthYear, formatShortDate } from "@/lib/display";
import { useT } from "@/lib/i18n";
import { percentChange, type Radar, type RadarRole, type RadarSkill } from "@/lib/radar";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/contracts";

/** One arXiv keyword as a tag that re-runs its count on arXiv. */
function KeywordTag({ keyword }: { keyword: CatalogueKeyword }) {
  const { t } = useT();
  return (
    <a
      href={keyword.url}
      target="_blank"
      rel="noreferrer"
      title={t("radar.keywordTitle", {
        recent: String(keyword.recent),
        previous: String(keyword.previous),
      })}
      className="tag transition-colors hover:text-ink"
    >
      {keyword.keyword}
      <span className="text-grey/80 tabular-nums">
        {t("radar.keywordDelta", {
          recent: String(keyword.recent),
          previous: String(keyword.previous),
          change: percentChange(keyword),
        })}
      </span>
    </a>
  );
}

function SkillCard({ skill, tone }: { skill: RadarSkill; tone: "up" | "down" }) {
  const Icon = tone === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-serif text-[20px] leading-tight font-medium first-letter:uppercase">{skill.label}</p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 font-serif text-[24px] leading-none font-medium tabular-nums",
            tone === "up" ? "text-sage" : "text-grey",
          )}
        >
          <Icon className="size-5" strokeWidth={1.6} />
          {skill.momentum > 0 ? "+" : "−"}
          {Math.abs(skill.momentum).toFixed(2)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {skill.keywords.map((keyword) => (
          <KeywordTag key={keyword.keyword} keyword={keyword} />
        ))}
      </div>
    </div>
  );
}

function SkillColumn({
  title,
  tone,
  skills,
  empty,
}: {
  title: string;
  tone: "up" | "down";
  skills: RadarSkill[];
  empty: string;
}) {
  const Icon = tone === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div>
      <h2 className="flex items-center gap-2 font-serif text-[28px] font-medium tracking-tight">
        <Icon className={cn("size-6", tone === "up" ? "text-sage" : "text-grey")} strokeWidth={1.6} />
        {title}
      </h2>
      {skills.length ? (
        <Stagger className="mt-5 space-y-4" gap={0.08}>
          {skills.map((skill) => (
            <StaggerItem key={skill.skillId}>
              <SkillCard skill={skill} tone={tone} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <p className="mt-5 text-[14px] text-grey">{empty}</p>
      )}
    </div>
  );
}

function RoleRows({ roles, empty }: { roles: RadarRole[]; empty: string }) {
  const { t } = useT();
  if (roles.length === 0) return <p className="mt-3 text-[14px] text-grey">{empty}</p>;
  return (
    <ul className="mt-2 divide-y divide-line">
      {roles.map((role) => (
        <li key={role.occupationId} className="flex items-center justify-between gap-3 py-3">
          <span className="font-medium">{role.title}</span>
          <span className="flex items-center gap-2">
            <span className="tag" title={role.signalSkills.map((skill) => skill.label).join(", ")}>
              {t("radar.skillsCount", {
                count: String(role.signalSkills.length),
                total: String(role.essentialSkills),
              })}
            </span>
            <span className="w-12 text-right text-[13px] text-grey tabular-nums">
              {role.momentum > 0 ? "+" : "−"}
              {Math.abs(role.momentum).toFixed(2)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RadarView({
  today,
  prior,
  dates,
  totalRoles,
}: {
  today: Radar | null;
  prior: Radar | null;
  dates: { today: IsoDate; prior: IsoDate | null };
  totalRoles: number;
}) {
  const reduce = useReducedMotion();
  const { t } = useT();
  const [signalDate, setSignalDate] = useState<SignalDate>("today");
  const radar = signalDate === "prior" && prior ? prior : today;

  return (
    <div className="pb-32 sm:pb-20">
      <div className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="flex flex-col gap-5 pt-10 pb-8 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p className="text-[13px] text-grey">{t("radar.eyebrow")}</p>
            <h1 className="mt-1 font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">
              {t("radar.heading")}
            </h1>
            <div className="mt-2 flex items-center gap-1 text-[15px] text-grey">
              {radar
                ? t("radar.summary", { date: formatDayMonthYear(radar.asOf, t) })
                : t("radar.noTrendData")}
              <InfoPopover label={t("radar.howMeasuredLabel")}>{t("radar.howMeasuredBody")}</InfoPopover>
            </div>
          </div>
          <SignalDateToggle
            value={radar?.signalDate ?? "today"}
            dates={dates}
            onChange={setSignalDate}
            layoutId="radar-signal-pill"
          />
        </motion.section>

        {radar && (
          <motion.div
            key={radar.signalDate}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            <section className="grid grid-cols-1 gap-10 border-t border-line pt-10 lg:grid-cols-2">
              <SkillColumn
                title={t("radar.rising")}
                tone="up"
                skills={radar.rising}
                empty={t("radar.risingEmpty")}
              />
              <SkillColumn
                title={t("radar.falling")}
                tone="down"
                skills={radar.declining}
                empty={t("radar.fallingEmpty")}
              />
            </section>

            {radar.steady.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[13px] text-grey">{t("radar.steady")}</span>
                {radar.steady.map((skill) => (
                  <span key={skill.skillId} className="tag first-letter:uppercase">
                    {skill.label}
                  </span>
                ))}
              </div>
            )}

            <section className="panel mt-12 p-6 sm:p-8">
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif text-[28px] font-medium tracking-tight">{t("radar.rolesTouches")}</h2>
                <InfoPopover label={t("radar.howRolesRatedLabel")}>
                  {t("radar.howRolesRatedBody", {
                    withoutSignal: String(radar.rolesWithoutSignal),
                    totalRoles: String(totalRoles),
                  })}
                </InfoPopover>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <p className="text-[13px] text-grey">{t("radar.rising")}</p>
                  <RoleRows roles={radar.risingRoles} empty={t("radar.noRisingRole")} />
                </div>
                <div>
                  <p className="text-[13px] text-grey">{t("radar.falling")}</p>
                  <RoleRows roles={radar.decliningRoles} empty={t("radar.noFallingRole")} />
                </div>
              </div>
            </section>

            <div className="mt-10 flex flex-col gap-5 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-grey">
                {t("radar.source", {
                  range: `${formatShortDate(radar.window.recent.start, t)}–${formatDayMonthYear(
                    radar.window.recent.end,
                    t,
                  )}`,
                })}
                {radar.tooSmall.length > 0 && (
                  <>
                    <span>·</span>
                    {t(
                      radar.tooSmall.length === 1 ? "radar.tooSmallOne" : "radar.tooSmallOther",
                      { count: String(radar.tooSmall.length) },
                    )}
                    <InfoPopover label={t("radar.tooSmallLabel")} panelClassName="bottom-6 sm:top-auto">
                      {t("radar.tooSmallBody", {
                        list: radar.tooSmall
                          .map((keyword) =>
                            t("radar.tooSmallItem", {
                              keyword: keyword.keyword,
                              recent: String(keyword.recent),
                              previous: String(keyword.previous),
                            }),
                          )
                          .join(", "),
                      })}
                    </InfoPopover>
                  </>
                )}
              </div>
              <Link href="/" className="btn-primary self-start sm:self-auto">
                {t("radar.matchYourSkills")}
                <ArrowRight className="size-4" strokeWidth={1.6} />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
      <EstimateFooter />
    </div>
  );
}
