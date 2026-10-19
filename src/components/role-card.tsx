// One recommended role: fit, status, SDG targets, and the top skill gap.
"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Check, ChevronDown, ShieldCheck, Sprout } from "lucide-react";
import { SdgBadge, sdgFlagId } from "@/components/sdg-badge";
import { SourceChip } from "@/components/source-chip";
import { formatFitPercent } from "@/lib/display";
import { cn } from "@/lib/utils";
import type { RoleResult, SdgLink } from "@/types/contracts";

export type RoleStatusTone = "robust" | "shift" | "interest";

const STATUS_ICON = {
  robust: ShieldCheck,
  shift: ArrowDownRight,
  interest: Sprout,
} as const;

export function RoleCard({
  role,
  rank,
  total,
  status,
  skillLinks,
  targetLabels,
  chosen,
  onChoose,
  flaggedIds,
  onFlag,
}: {
  role: RoleResult;
  rank: number;
  total: number;
  status: { label: string; tone: RoleStatusTone };
  skillLinks: readonly SdgLink[];
  targetLabels: Readonly<Record<string, string>>;
  chosen: boolean;
  onChoose: (role: RoleResult) => void;
  flaggedIds: ReadonlySet<string>;
  onFlag: (link: SdgLink) => void;
}) {
  const [skillsOpen, setSkillsOpen] = useState(true);
  const reduceMotion = useReducedMotion();
  const skillsId = useId();
  const fitPercent = Math.round(role.fit * 100);
  const StatusIcon = STATUS_ICON[status.tone];

  return (
    <motion.article
      layout
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-white p-5 sm:p-6",
        role.robust ? "border-sage-tint ring-1 ring-sage-tint/60" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]",
            status.tone === "robust" ? "bg-sage-soft font-medium text-sage-dark" : "bg-alt text-grey",
          )}
        >
          <StatusIcon className="size-3.5" strokeWidth={1.6} />
          {status.label}
        </span>
        <span className="shrink-0 text-[12px] text-grey">
          #{rank} of {total}
        </span>
      </div>

      <h3 className="mt-4 font-serif text-[24px] leading-tight font-medium">{role.title}</h3>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-[28px] leading-none font-semibold tabular-nums">{formatFitPercent(role.fit)}</span>
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-alt">
            <div className="h-1.5 rounded-full bg-ink" style={{ width: `${fitPercent}%` }} />
          </div>
          <p className="mt-1 text-[12px] text-grey">fit with your current skills</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-[50px] flex-wrap content-start gap-1.5">
        {role.sdg.map((link) => (
          <SdgBadge
            key={sdgFlagId(link)}
            link={link}
            label={targetLabels[link.target] ?? link.target}
            flagged={flaggedIds.has(sdgFlagId(link))}
            onFlag={onFlag}
          />
        ))}
      </div>

      <button
        type="button"
        className="mt-5 mb-1 flex w-full items-center justify-between text-left text-[12px] text-grey"
        aria-expanded={skillsOpen}
        aria-controls={skillsId}
        onClick={() => setSkillsOpen((open) => !open)}
      >
        <span>Top 5 skills to build</span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", skillsOpen && "rotate-180")}
          strokeWidth={1.6}
        />
      </button>
      {skillsOpen && (
        <ul id={skillsId} className="divide-y divide-line border-y border-line text-[13px]">
          {role.gap.map((skill) => {
            const link = skillLinks.find(
              (item) => item.subject.kind === "skill" && item.subject.skillId === skill.skillId,
            );
            return (
              <li key={skill.skillId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <span>{skill.label}</span>
                {link && (
                  <SdgBadge
                    link={link}
                    label={targetLabels[link.target] ?? link.target}
                    compact
                    flagged={flaggedIds.has(sdgFlagId(link))}
                    onFlag={onFlag}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 mb-5 flex flex-wrap gap-1.5">
        {role.sources.map((source) => (
          <SourceChip key={`${source.dataset}-${source.releaseDate}`} source={source} />
        ))}
      </div>

      <button
        type="button"
        aria-pressed={chosen}
        onClick={() => onChoose(role)}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-[14px] font-medium text-white"
      >
        {chosen && <Check className="size-4" strokeWidth={1.6} />}
        {chosen ? "Chosen" : "Choose this role"}
      </button>
    </motion.article>
  );
}
