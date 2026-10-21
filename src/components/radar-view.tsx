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
import { percentChange, type Radar, type RadarRole, type RadarSkill } from "@/lib/radar";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/contracts";

/** One arXiv keyword as a tag that re-runs its count on arXiv. */
function KeywordTag({ keyword }: { keyword: CatalogueKeyword }) {
  return (
    <a
      href={keyword.url}
      target="_blank"
      rel="noreferrer"
      title={`${keyword.recent} papers in the last 90 days vs ${keyword.previous} before. Opens the arXiv query.`}
      className="tag transition-colors hover:text-ink"
    >
      {keyword.keyword}
      <span className="text-grey/80 tabular-nums">
        {keyword.recent} vs {keyword.previous} · {percentChange(keyword)}
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
  if (roles.length === 0) return <p className="mt-3 text-[14px] text-grey">{empty}</p>;
  return (
    <ul className="mt-2 divide-y divide-line">
      {roles.map((role) => (
        <li key={role.occupationId} className="flex items-center justify-between gap-3 py-3">
          <span className="font-medium">{role.title}</span>
          <span className="flex items-center gap-2">
            <span className="tag" title={role.signalSkills.map((skill) => skill.label).join(", ")}>
              {role.signalSkills.length} of {role.essentialSkills} skills
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
            <p className="text-[13px] text-grey">Future Skills Radar</p>
            <h1 className="mt-1 font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">
              Which skills are moving
            </h1>
            <div className="mt-2 flex items-center gap-1 text-[15px] text-grey">
              {radar
                ? `arXiv papers, last 90 days vs the 90 before. Checked ${formatDayMonthYear(radar.asOf)}.`
                : "No trend data yet."}
              <InfoPopover label="How the radar is measured">
                Momentum = ln((papers in the last 90 days + 1) / (papers in the 90 days before + 1)), averaged over the
                arXiv keywords mapped to each ESCO skill. Within ±10% counts as steady. A research signal, not a job
                forecast.
              </InfoPopover>
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
              <SkillColumn title="Rising" tone="up" skills={radar.rising} empty="Nothing rose by more than 10%." />
              <SkillColumn title="Falling" tone="down" skills={radar.declining} empty="Nothing fell by more than 10%." />
            </section>

            {radar.steady.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[13px] text-grey">Steady</span>
                {radar.steady.map((skill) => (
                  <span key={skill.skillId} className="tag first-letter:uppercase">
                    {skill.label}
                  </span>
                ))}
              </div>
            )}

            <section className="panel mt-12 p-6 sm:p-8">
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif text-[28px] font-medium tracking-tight">Roles it touches</h2>
                <InfoPopover label="How roles are rated">
                  A role&rsquo;s trend is the average of its ESCO essential skills that have a signal. Our keywords cover
                  only a few skills, so {radar.rolesWithoutSignal} of {totalRoles} roles have no signal yet and each role
                  here rests on very few skills. Hints, not ratings.
                </InfoPopover>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <p className="text-[13px] text-grey">Rising</p>
                  <RoleRows roles={radar.risingRoles} empty="No role is rising in this snapshot." />
                </div>
                <div>
                  <p className="text-[13px] text-grey">Falling</p>
                  <RoleRows roles={radar.decliningRoles} empty="No role is falling in this snapshot." />
                </div>
              </div>
            </section>

            <div className="mt-10 flex flex-col gap-5 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-grey">
                Source: arXiv API · {formatShortDate(radar.window.recent.start)}–
                {formatDayMonthYear(radar.window.recent.end)}
                {radar.tooSmall.length > 0 && (
                  <>
                    <span>·</span>
                    {radar.tooSmall.length} keyword{radar.tooSmall.length === 1 ? "" : "s"} too small to use
                    <InfoPopover label="Keywords too small to use" panelClassName="bottom-6 sm:top-auto">
                      Fewer than 20 papers in both windows, so they are left out:{" "}
                      {radar.tooSmall.map((keyword) => `${keyword.keyword} (${keyword.recent} vs ${keyword.previous})`).join(", ")}.
                    </InfoPopover>
                  </>
                )}
              </div>
              <Link href="/" className="btn-primary self-start sm:self-auto">
                Match your own skills
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
