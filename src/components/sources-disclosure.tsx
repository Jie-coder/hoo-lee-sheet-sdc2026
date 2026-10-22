// Merges a card's source chips into one "ⓘ n sources" control. Collapsed by
// default; opens to the full dated source list, so nothing is lost, only hidden.
"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { SourceChip } from "@/components/source-chip";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Source } from "@/types/contracts";

export function SourcesDisclosure({ sources, className }: { sources: readonly Source[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const id = useId();

  if (sources.length === 0) return null;

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className={cn("inline-flex items-center gap-1 text-[12px] text-grey", open && "text-ink")}
      >
        <Info className="size-3.5" strokeWidth={1.6} />
        {t(sources.length === 1 ? "sourcesDisclosure.one" : "sourcesDisclosure.other", {
          count: String(sources.length),
        })}
      </button>
      {open && (
        <div id={id} className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((source) => (
            <SourceChip key={`${source.dataset}-${source.releaseDate}`} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}
