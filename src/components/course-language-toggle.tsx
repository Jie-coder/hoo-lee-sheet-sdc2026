// Multi-select course-language chips: EN / BM / 中文. Shared by Profile and
// the "What we know so far" panel on Interview.
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/contracts";

const LABELS: Record<LanguageCode, string> = { en: "EN", ms: "BM", zh: "中文" };
const ORDER: readonly LanguageCode[] = ["en", "ms", "zh"];

export function CourseLanguageToggle({
  value,
  onToggle,
}: {
  value: readonly LanguageCode[];
  onToggle: (language: LanguageCode) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {ORDER.map((language) => {
        const selected = value.includes(language);
        return (
          <button
            key={language}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(language)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium",
              selected ? "bg-ink text-white" : "border border-line text-grey",
            )}
          >
            {selected && <Check className="size-3" strokeWidth={1.6} />}
            {LABELS[language]}
          </button>
        );
      })}
    </div>
  );
}
