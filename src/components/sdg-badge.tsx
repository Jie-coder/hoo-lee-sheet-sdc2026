// SDG target badge. Sage only: solid, outlined with probability, or dashed.
"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SdgLink } from "@/types/contracts";

export function sdgFlagId(link: SdgLink): string {
  const subjectId = link.subject.kind === "occupation" ? link.subject.occupationId : link.subject.skillId;
  return `${link.subject.kind}:${subjectId}:${link.target}`;
}

const TIER_CLASS = {
  direct: "border border-sage bg-sage font-medium text-white",
  supporting: "border border-sage text-sage-dark",
  inferred: "border border-dashed border-sage text-sage-dark",
} as const;

export function SdgBadge({
  link,
  label,
  compact = false,
  flagged = false,
  onFlag,
}: {
  link: SdgLink;
  label: string;
  /** Target id only, for a skill row. Inferred still shows why and flag. */
  compact?: boolean;
  flagged?: boolean;
  onFlag?: (link: SdgLink) => void;
}) {
  const name = compact ? link.target : `${link.target} ${label}`.trim();
  const text =
    link.tier === "supporting"
      ? `${name} · ${link.confidence.toFixed(2)}`
      : link.tier === "inferred"
        ? `${name} · AI-suggested`
        : name;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-md px-2 py-0.5 text-[12px]", compact && "px-1.5 text-[11px]", TIER_CLASS[link.tier])}>
        {text}
      </span>
      {link.tier === "inferred" && (
        <>
          <Tooltip>
            <TooltipTrigger
              aria-label={`Why target ${link.target} was suggested`}
              className="text-[11px] text-sage-dark underline decoration-dotted underline-offset-2"
            >
              why
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-left leading-relaxed">
              {link.reason}
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={() => onFlag?.(link)}
            disabled={flagged || !onFlag}
            className="text-[11px] text-grey underline-offset-2 hover:underline disabled:no-underline"
          >
            {flagged ? "Flagged" : "Flag this"}
          </button>
        </>
      )}
    </span>
  );
}
