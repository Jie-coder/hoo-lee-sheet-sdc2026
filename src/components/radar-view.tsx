// Future Skills Radar (spec §7): Caldera hero with the dated signal line, an
// interchange map (Rising Plasma / Flat Obsidian dashed / Declining Ember thin,
// max 6 stations a line), three compact lists (tabs at mobile, where the map
// hides), a drawer per skill with its arXiv counts, linked roles and SDG chip.
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Drawer, PageHero, Perforation, SdgChip, SourceRow } from "@/components/caldera";
import { SignalDateToggle } from "@/components/signal-date-toggle";
import { InfoPopover } from "@/components/ui/info-popover";
import type { SignalDate } from "@/lib/analyze";
import { formatDayMonthYear, formatShortDate } from "@/lib/display";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";
import { percentChange, type Radar, type RadarSkill } from "@/lib/radar";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/contracts";

export type SkillLinks = Record<
  string,
  { roles: { id: string; title: string }[]; totalRoles: number; sdg: { target: string; label: string } | null }
>;

type Direction = "rising" | "flat" | "declining";
const MAX_STATIONS = 6;

const LINES: ReadonlyArray<{ id: Direction; label: MessageKey; arrow: string; empty: MessageKey }> = [
  { id: "rising", label: "radar.rising", arrow: "↑", empty: "radar.risingEmpty" },
  { id: "flat", label: "radar.flat", arrow: "→", empty: "radar.noTrendData" },
  { id: "declining", label: "radar.falling", arrow: "↓", empty: "radar.fallingEmpty" },
];

/** Line styles: one accent colour per line. */
const STROKE: Record<Direction, { color: string; width: number; dash?: string }> = {
  rising: { color: "var(--color-plasma)", width: 8 },
  flat: { color: "var(--color-ink)", width: 3, dash: "10 8" },
  declining: { color: "var(--color-sage)", width: 3 },
};
const DOT: Record<Direction, string> = {
  rising: "bg-plasma",
  flat: "bg-card",
  declining: "bg-sage",
};

function skillsFor(radar: Radar, direction: Direction): RadarSkill[] {
  return direction === "rising" ? radar.rising : direction === "flat" ? radar.steady : radar.declining;
}

function signed(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(2)}`;
}

// Map geometry in a 1200 x 420 box: the three lines leave one interchange on
// the left, fan out, then run level with their stations.
const VIEW_W = 1200;
const VIEW_H = 420;
const HUB = { x: 90, y: 210 };
const ROW_Y: Record<Direction, number> = { rising: 90, flat: 210, declining: 330 };
const STATION_X0 = 330;
const STATION_X1 = 1110;

function stationX(index: number, count: number): number {
  if (count <= 1) return (STATION_X0 + STATION_X1) / 2;
  return STATION_X0 + ((STATION_X1 - STATION_X0) * index) / (count - 1);
}

function InterchangeMap({ radar, onPick }: { radar: Radar; onPick: (skill: RadarSkill, direction: Direction) => void }) {
  const { t } = useT();
  return (
    <section aria-label={t("radar.mapLabel")} className="mt-16 hidden rounded-[40px] bg-card p-8 md:block lg:p-10">
      <div className="relative" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 size-full" aria-hidden>
          {LINES.map((line) => {
            const y = ROW_Y[line.id];
            const stroke = STROKE[line.id];
            return (
              <path
                key={line.id}
                d={`M ${HUB.x} ${HUB.y} C ${HUB.x + 110} ${HUB.y}, ${HUB.x + 90} ${y}, ${HUB.x + 200} ${y} L ${STATION_X1 + 50} ${y}`}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeDasharray={stroke.dash}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx={HUB.x} cy={HUB.y} r={18} fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth={3} />
        </svg>
        {LINES.map((line) => {
          const stations = skillsFor(radar, line.id).slice(0, MAX_STATIONS);
          const y = (ROW_Y[line.id] / VIEW_H) * 100;
          return (
            <div key={line.id}>
              <p
                className="absolute -translate-y-[calc(100%+14px)] font-mono text-[11px] tracking-[0.06em] text-grey uppercase"
                style={{ left: `${((HUB.x + 200) / VIEW_W) * 100}%`, top: `${y}%` }}
              >
                {t(line.label)} {line.arrow}
              </p>
              {stations.map((skill, index) => (
                <button
                  key={skill.skillId}
                  type="button"
                  onClick={() => onPick(skill, line.id)}
                  className="group absolute flex w-[132px] -translate-x-1/2 -translate-y-[9px] flex-col items-center gap-2 text-center"
                  style={{ left: `${(stationX(index, stations.length) / VIEW_W) * 100}%`, top: `${y}%` }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-[18px] rounded-full ring-[1.5px] ring-ink transition-transform group-hover:scale-125",
                      DOT[line.id],
                    )}
                  />
                  <span className="line-clamp-2 font-mono text-[10px] leading-tight tracking-[0.04em] text-ink uppercase group-hover:underline lg:text-[11px]">
                    {skill.label}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SkillList({
  radar,
  direction,
  onPick,
}: {
  radar: Radar;
  direction: Direction;
  onPick: (skill: RadarSkill, direction: Direction) => void;
}) {
  const { t } = useT();
  const line = LINES.find((item) => item.id === direction)!;
  const skills = skillsFor(radar, direction);
  return (
    <div className="rounded-[40px] bg-card p-7">
      <h2 className="flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] uppercase">
        <span aria-hidden className={cn("size-3.5 rounded-full ring-[1.5px] ring-ink", DOT[direction])} />
        {t(line.label)} {line.arrow}
      </h2>
      {skills.length ? (
        <ul className="mt-4 divide-y divide-dashed divide-ink/20">
          {skills.map((skill) => (
            <li key={skill.skillId}>
              <button
                type="button"
                onClick={() => onPick(skill, direction)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left hover:underline"
              >
                <span className="text-[16px] font-medium first-letter:uppercase">{skill.label}</span>
                <span className="shrink-0 font-mono text-[12px] text-grey tabular-nums">{signed(skill.momentum)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[14px] text-grey">{t(line.empty)}</p>
      )}
    </div>
  );
}

function SkillDrawerBody({ skill, direction, radar, links }: { skill: RadarSkill; direction: Direction; radar: Radar; links: SkillLinks }) {
  const { t } = useT();
  const link = links[skill.skillId];
  const line = LINES.find((item) => item.id === direction)!;
  return (
    <div className="flex flex-col gap-6 text-[15px]">
      <p className="flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] uppercase">
        <span aria-hidden className={cn("size-3.5 rounded-full ring-[1.5px] ring-ink", DOT[direction])} />
        {t(line.label)} {line.arrow} · {t("radar.momentum", { value: signed(skill.momentum) })}
      </p>

      <div>
        <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("radar.drawerTrend")}</p>
        <p className="mt-1 text-[13px] text-grey">
          {t("radar.drawerWindow", { end: formatDayMonthYear(radar.window.recent.end, t) })}
        </p>
        {skill.keywords.length ? (
          <ul className="mt-3 space-y-2">
            {skill.keywords.map((keyword) => (
              <li key={keyword.keyword} className="flex items-baseline justify-between gap-3">
                <a href={keyword.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
                  {keyword.keyword} ↗
                </a>
                <span className="shrink-0 font-mono text-[12px] text-grey tabular-nums">
                  {t("radar.keywordDelta", {
                    recent: String(keyword.recent),
                    previous: String(keyword.previous),
                    change: percentChange(keyword),
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-grey">{t("radar.drawerNoKeywords")}</p>
        )}
      </div>

      <Perforation />

      <div>
        <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("radar.drawerRoles")}</p>
        {link && link.roles.length ? (
          <ul className="mt-3 space-y-1.5">
            {link.roles.map((role) => (
              <li key={role.id} className="font-medium first-letter:uppercase">
                {role.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-grey">{t("radar.drawerNoRoles")}</p>
        )}
      </div>

      {link?.sdg && (
        <div>
          <SdgChip>
            SDG {link.sdg.target} {link.sdg.label}
          </SdgChip>
        </div>
      )}
    </div>
  );
}

export function RadarView({
  today,
  prior,
  dates,
  links,
}: {
  today: Radar | null;
  prior: Radar | null;
  dates: { today: IsoDate; prior: IsoDate | null };
  links: SkillLinks;
}) {
  const { t } = useT();
  const [signalDate, setSignalDate] = useState<SignalDate>("today");
  const [tab, setTab] = useState<Direction>("rising");
  const [picked, setPicked] = useState<{ skill: RadarSkill; direction: Direction } | null>(null);
  const radar = signalDate === "prior" && prior ? prior : today;
  const onPick = (skill: RadarSkill, direction: Direction) => setPicked({ skill, direction });

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-6 md:px-8">
      <PageHero
        className="pt-6 md:pt-10"
        eyebrow={t("radar.eyebrow")}
        title={t("radar.heroHeading")}
        lede={t("radar.lede")}
      />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1 font-mono text-[12px] tracking-[0.06em] uppercase">
          {radar ? t("radar.signalChecked", { date: formatDayMonthYear(radar.asOf, t) }) : t("radar.noTrendData")}
          <InfoPopover label={t("radar.howMeasuredLabel")}>{t("radar.howMeasuredBody")}</InfoPopover>
        </p>
        <SignalDateToggle
          value={radar?.signalDate ?? "today"}
          dates={dates}
          onChange={setSignalDate}
          layoutId="radar-signal-pill"
        />
      </div>

      {radar && (
        <>
          <InterchangeMap radar={radar} onPick={onPick} />

          {/* Mobile: one list at a time behind a segmented pill. */}
          <div
            role="tablist"
            aria-label={t("radar.listsLabel")}
            className="mt-10 flex gap-1 rounded-full bg-card p-1 md:hidden"
          >
            {LINES.map((line) => (
              <button
                key={line.id}
                type="button"
                role="tab"
                id={`radar-tab-${line.id}`}
                aria-controls={`radar-panel-${line.id}`}
                aria-selected={tab === line.id}
                tabIndex={tab === line.id ? 0 : -1}
                onClick={() => setTab(line.id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                  event.preventDefault();
                  const i = LINES.findIndex((l) => l.id === line.id);
                  const next = LINES[(i + (event.key === "ArrowRight" ? 1 : LINES.length - 1)) % LINES.length];
                  setTab(next.id);
                  document.getElementById(`radar-tab-${next.id}`)?.focus();
                }}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 font-mono text-[11px] tracking-[0.06em] uppercase transition-colors",
                  tab === line.id ? "bg-ink text-card" : "text-ink",
                )}
              >
                {t(line.label)} {line.arrow}
              </button>
            ))}
          </div>
          <section aria-label={t("radar.listsLabel")} className="mt-4 grid grid-cols-1 gap-4 md:mt-4 md:grid-cols-3">
            {LINES.map((line) => (
              <div
                key={line.id}
                id={`radar-panel-${line.id}`}
                aria-labelledby={`radar-tab-${line.id}`}
                className={cn(tab === line.id ? "block" : "hidden", "md:block")}
              >
                <SkillList radar={radar} direction={line.id} onPick={onPick} />
              </div>
            ))}
          </section>

          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SourceRow
              className="mt-0"
              sources={[
                {
                  label: `arXiv API · ${formatShortDate(radar.window.recent.start, t)}–${formatDayMonthYear(radar.window.recent.end, t)}`,
                  href: "https://arxiv.org/help/api/index",
                },
                { label: "ESCO" },
              ]}
            />
            <Link href="/" className="btn-primary shrink-0 self-start px-5 py-3 text-[15px] sm:self-auto">
              {t("radar.matchYourSkills")}
              <ArrowRight className="size-4" strokeWidth={1.6} />
            </Link>
          </div>

          <Drawer open={picked !== null} onClose={() => setPicked(null)} title={picked?.skill.label ?? ""}>
            {picked && <SkillDrawerBody skill={picked.skill} direction={picked.direction} radar={radar} links={links} />}
          </Drawer>
        </>
      )}

      {!radar && <SourceRow className="mt-10" />}
    </main>
  );
}
