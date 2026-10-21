// Future Skills Radar view: rising / falling skills with the arXiv counts
// behind each one, the roles they touch, and the same date toggle as /results.
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { EstimateFooter } from "@/components/estimate-footer";
import { SignalDateToggle } from "@/components/signal-date-toggle";
import type { SignalDate } from "@/lib/analyze";
import type { CatalogueKeyword } from "@/lib/catalogue";
import { formatDayMonthYear } from "@/lib/display";
import { percentChange, type Radar, type RadarRole, type RadarSkill } from "@/lib/radar";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/contracts";

function KeywordLine({ keyword }: { keyword: CatalogueKeyword }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1 text-[12px]">
      <span className="text-ink">{keyword.keyword}</span>
      <span className="text-grey tabular-nums">
        {keyword.recent} vs {keyword.previous} papers ({percentChange(keyword)}) ·{" "}
        <a href={keyword.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          arXiv
        </a>
      </span>
    </li>
  );
}

function SkillCard({ skill, tone }: { skill: RadarSkill; tone: "up" | "down" }) {
  const Icon = tone === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium first-letter:uppercase">{skill.label}</p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] tabular-nums",
            tone === "up" ? "bg-sage-soft text-sage-dark" : "bg-alt text-grey",
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.6} />
          {skill.momentum > 0 ? "+" : "−"}
          {Math.abs(skill.momentum).toFixed(2)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-grey">ESCO skill · momentum from {skill.keywords.length} arXiv keyword{skill.keywords.length === 1 ? "" : "s"}</p>
      <ul className="mt-2 divide-y divide-line border-t border-line">
        {skill.keywords.map((keyword) => (
          <KeywordLine key={keyword.keyword} keyword={keyword} />
        ))}
      </ul>
    </li>
  );
}

function RoleList({ roles, empty }: { roles: RadarRole[]; empty: string }) {
  if (roles.length === 0) return <p className="text-[13px] text-grey">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {roles.map((role) => (
        <li key={role.occupationId} className="py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{role.title}</span>
            <span className="text-[12px] text-grey tabular-nums">
              {role.momentum > 0 ? "+" : "−"}
              {Math.abs(role.momentum).toFixed(2)}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-grey">
            Based on {role.signalSkills.length} of its {role.essentialSkills} essential skills (
            {role.signalSkills.map((skill) => skill.label).join(", ")})
          </p>
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
  const [signalDate, setSignalDate] = useState<SignalDate>("today");
  const radar = signalDate === "prior" && prior ? prior : today;

  return (
    <div className="bg-paper pb-32 text-ink sm:pb-16">
      <main className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <section className="flex flex-col gap-3 pt-7 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] text-grey">Step 2 of the journey · for everyone, before matching</p>
            <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-medium tracking-tight sm:text-[36px]">
              Future Skills Radar
            </h1>
            <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-grey">
              Which skills are gaining or losing attention in AI research, measured by arXiv papers in the last 90
              days against the 90 days before. A research signal, not a job forecast: it estimates where tools and
              demand may move next.
            </p>
          </div>
          <SignalDateToggle value={radar?.signalDate ?? "today"} dates={dates} onChange={setSignalDate} />
        </section>

        {!radar ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-[14px] text-grey">
            No trend data yet: data/keywords.csv has no keyword with enough papers.
          </p>
        ) : (
          <>
            <p className="text-[12px] text-grey">
              arXiv API · papers submitted {formatDayMonthYear(radar.window.recent.start)} –{" "}
              {formatDayMonthYear(radar.window.recent.end)} vs {formatDayMonthYear(radar.window.previous.start)} –{" "}
              {formatDayMonthYear(radar.window.previous.end)} · checked {formatDayMonthYear(radar.asOf)}
            </p>

            <section className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-serif text-[22px] font-medium">
                  <ArrowUpRight className="size-5 text-sage" strokeWidth={1.6} /> Rising skills
                </h2>
                {radar.rising.length ? (
                  <ul className="space-y-3">
                    {radar.rising.map((skill) => (
                      <SkillCard key={skill.skillId} skill={skill} tone="up" />
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-grey">No skill rose by more than 10% in this snapshot.</p>
                )}
              </div>
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-serif text-[22px] font-medium">
                  <ArrowDownRight className="size-5 text-grey" strokeWidth={1.6} /> Falling skills
                </h2>
                {radar.declining.length ? (
                  <ul className="space-y-3">
                    {radar.declining.map((skill) => (
                      <SkillCard key={skill.skillId} skill={skill} tone="down" />
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-grey">No skill fell by more than 10% in this snapshot.</p>
                )}
              </div>
            </section>

            {radar.steady.length > 0 && (
              <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-grey">
                <Minus className="size-4" strokeWidth={1.6} />
                <span className="font-medium text-ink">Steady (within ±10%):</span>
                {radar.steady.map((skill) => skill.label).join(" · ")}
              </p>
            )}

            <section className="mt-12 rounded-2xl border border-line bg-white p-5 sm:p-6">
              <h2 className="font-serif text-[22px] font-medium">Roles these signals touch</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-grey">
                A role&rsquo;s trend is the average of its ESCO essential skills that have a signal. Our 25 keywords
                cover only a few skills, so {radar.rolesWithoutSignal} of {totalRoles} roles have no signal yet, and
                each role below rests on very few skills. Read these as hints, not ratings.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold tracking-[0.12em] text-grey">RISING</h3>
                  <RoleList roles={radar.risingRoles} empty="No role has a rising signal in this snapshot." />
                </div>
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold tracking-[0.12em] text-grey">FALLING</h3>
                  <RoleList roles={radar.decliningRoles} empty="No role has a falling signal in this snapshot." />
                </div>
              </div>
            </section>

            {radar.tooSmall.length > 0 && (
              <section className="mt-6 text-[12px] text-grey">
                <p className="font-medium text-ink">Too few papers to read as a trend (not used):</p>
                <ul className="mt-1">
                  {radar.tooSmall.map((keyword) => (
                    <KeywordLine key={keyword.keyword} keyword={keyword} />
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-12 flex flex-col items-start gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[640px] text-[12px] leading-relaxed text-grey/80">
                Momentum = ln((papers in the last 90 days + 1) / (papers in the 90 days before + 1)), averaged over the
                keywords mapped to each ESCO skill. Keywords with fewer than 20 papers in both windows are left out.
                Counts come from the public arXiv API; each &ldquo;arXiv&rdquo; link re-runs the count.
              </p>
              <Link
                href="/"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-medium text-white"
              >
                Match your own skills
                <ArrowRight className="size-4" strokeWidth={1.6} />
              </Link>
            </section>
          </>
        )}
      </main>
      <EstimateFooter />
    </div>
  );
}
