// One recommended role, collapsed by default: status, rank, title, fit,
// one-line reason, the top SDG target, and 3 skills. Everything else (the
// full "why", every SDG target and its reason, and "Flag this") lives in
// the Details expander below, collapsed, never deleted.
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Check, Flag, ShieldCheck, Sprout } from "lucide-react";
import { EASE_OUT } from "@/components/motion";
import { Disclosure } from "@/components/ui/disclosure";
import { SdgBadge, sdgFlagId } from "@/components/sdg-badge";
import { SourcesDisclosure } from "@/components/sources-disclosure";
import { formatFitPercent } from "@/lib/display";
import { formatMonthlyRm, salaryForRole } from "@/lib/salary";
import { cn } from "@/lib/utils";
import type { RoleResult, SdgLink } from "@/types/contracts";

export type RoleStatusTone = "robust" | "shift" | "interest";

const STATUS_ICON = {
  robust: ShieldCheck,
  shift: ArrowDownRight,
  interest: Sprout,
} as const;

const TIER_LABEL = { direct: "Direct", supporting: "Supporting", inferred: "AI-suggested" } as const;

const SKILLS_COLLAPSED = 3;

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
  const reduceMotion = useReducedMotion();
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [sdgExpanded, setSdgExpanded] = useState(false);
  const fitPercent = Math.round(role.fit * 100);
  const StatusIcon = STATUS_ICON[status.tone];

  const topSdg = role.sdg[0];
  const extraSdgCount = role.sdg.length - 1;
  const visibleSkills = role.gap.slice(0, SKILLS_COLLAPSED);
  const extraSkills = role.gap.slice(SKILLS_COLLAPSED);
  const salary = salaryForRole(role.occupationId);
  const inferredLink = role.sdg.find((link) => link.tier === "inferred");
  const inferredFlagged = inferredLink ? flaggedIds.has(sdgFlagId(inferredLink)) : false;

  function skillTarget(skillId: string): SdgLink | undefined {
    return skillLinks.find((item) => item.subject.kind === "skill" && item.subject.skillId === skillId);
  }

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { layout: { type: "spring", stiffness: 420, damping: 36 }, duration: 0.55, delay: (rank - 1) * 0.08, ease: EASE_OUT }}
      className={cn(
        "panel flex h-full flex-col p-6 transition-[border-color,box-shadow] duration-300",
        role.robust ? "border-sage/60 shadow-[0_0_0_1px_var(--color-sage-tint)]" : "",
        chosen && "border-ink shadow-[0_0_0_1px_var(--color-ink)]",
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
        <span className="shrink-0 font-serif text-[14px] text-grey tabular-nums">
          #{rank} of {total}
        </span>
      </div>

      <h3 className="mt-5 font-serif text-[26px] leading-tight font-medium">{role.title}</h3>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-serif text-[30px] leading-none font-medium tabular-nums">{formatFitPercent(role.fit)}</span>
        <div className="flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-alt">
            <motion.div
              className="h-1 rounded-full bg-ink"
              initial={reduceMotion ? { width: `${fitPercent}%` } : { width: 0 }}
              animate={{ width: `${fitPercent}%` }}
              transition={{ duration: 1, ease: EASE_OUT, delay: 0.3 + (rank - 1) * 0.1 }}
            />
          </div>
          <p className="mt-1 text-[12px] text-grey">fit with your skills</p>
        </div>
      </div>

      {/* Two lines at a glance; the full reason is repeated under Details. */}
      {role.explanation && <p className="mt-4 line-clamp-2 text-[14px] leading-relaxed text-grey">{role.explanation}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <SdgBadge link={topSdg} label={targetLabels[topSdg.target] ?? topSdg.target} plain />
        {extraSdgCount > 0 && (
          <button
            type="button"
            aria-expanded={sdgExpanded}
            onClick={() => setSdgExpanded((current) => !current)}
            className="tag"
          >
            {sdgExpanded ? "Show less" : `+${extraSdgCount}`}
          </button>
        )}
        {sdgExpanded &&
          role.sdg
            .slice(1)
            .map((link) => (
              <SdgBadge key={link.target} link={link} label={targetLabels[link.target] ?? link.target} plain />
            ))}
      </div>

      <p className="mt-5 text-[12px] text-grey">Skills to build</p>
      <ul className="mt-1 text-[14px]">
        {visibleSkills.map((skill) => {
          const link = skillTarget(skill.skillId);
          return (
            <li key={skill.skillId} className="flex items-center justify-between gap-3 py-1.5">
              <span>{skill.label}</span>
              {link && <span className="text-[11px] text-grey tabular-nums">{link.target}</span>}
            </li>
          );
        })}
      </ul>
      {extraSkills.length > 0 && (
        <div>
          {skillsExpanded && (
            <ul className="text-[14px]">
              {extraSkills.map((skill) => {
                const link = skillTarget(skill.skillId);
                return (
                  <li key={skill.skillId} className="flex items-center justify-between gap-3 py-1.5">
                    <span>{skill.label}</span>
                    {link && <span className="text-[11px] text-grey tabular-nums">{link.target}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            aria-expanded={skillsExpanded}
            onClick={() => setSkillsExpanded((current) => !current)}
            className="flex w-full items-center justify-start gap-2 py-1.5 text-left text-[13px] text-grey hover:text-ink"
          >
            {skillsExpanded ? "Show less" : `+${extraSkills.length} more`}
          </button>
        </div>
      )}

      <div className="mt-5">
        <Disclosure summary={<span className="text-[13px] font-medium">Details</span>}>
          <div className="mt-3 space-y-4 text-[13px]">
            <div>
              <p className="mb-1 text-[12px] text-grey">Why this role</p>
              <p className="leading-relaxed">
                {status.label}
                {role.explanation ? `. ${role.explanation}` : ""}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[12px] text-grey">SDG targets and why</p>
              <ul>
                {role.sdg.map((link) => (
                  <li key={link.target} className="flex items-start gap-2 py-1">
                    <span className="shrink-0">
                      <SdgBadge link={link} label={targetLabels[link.target] ?? link.target} plain />
                    </span>
                    <span className="pt-0.5 text-[12px] text-grey">
                      {TIER_LABEL[link.tier]}: {link.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {inferredLink && (
              <button
                type="button"
                onClick={() => onFlag(inferredLink)}
                disabled={inferredFlagged}
                className="inline-flex items-center gap-1 text-[12px] text-grey underline underline-offset-4 disabled:no-underline"
              >
                <Flag className="size-3.5" strokeWidth={1.6} />
                {inferredFlagged ? "Flagged" : "Flag this"}
              </button>
            )}
          </div>
        </Disclosure>
      </div>

      <div className="mt-auto pt-6">
        <div className="mb-4 border-t border-line pt-4">
          {salary ? (
            <>
              <p className="font-serif text-[26px] font-medium tabular-nums">{formatMonthlyRm(salary.avgMonthlyRm)}</p>
              <p className="text-[12px] text-grey">
                MASCO {salary.mascoMajor} {salary.mascoMajorName} · DOSM {salary.year}
              </p>
              <p className="text-[11px] text-grey/80">Average for the whole occupation group</p>
            </>
          ) : (
            <p className="text-[13px] text-grey">Salary data not available</p>
          )}
        </div>
        <button type="button" aria-pressed={chosen} onClick={() => onChoose(role)} className="btn-primary w-full">
          {chosen && <Check className="size-4" strokeWidth={2} />}
          {chosen ? "Chosen" : "Choose this role"}
        </button>
        <div className="pt-3">
          <SourcesDisclosure sources={role.sources} />
        </div>
      </div>
    </motion.article>
  );
}
