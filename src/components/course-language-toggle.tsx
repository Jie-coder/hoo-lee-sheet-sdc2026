// Multi-select course-language chips: EN / BM / 中文. Shared by Profile and
// the Interview summary strip.
"use client";

import { Check } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import type { LanguageCode } from "@/types/contracts";

const LABELS: Record<LanguageCode, MessageKey> = {
  en: "courseLanguageToggle.en",
  ms: "courseLanguageToggle.ms",
  zh: "courseLanguageToggle.zh",
};
const ORDER: readonly LanguageCode[] = ["en", "ms", "zh"];

export function CourseLanguageToggle({
  value,
  onToggle,
}: {
  value: readonly LanguageCode[];
  onToggle: (language: LanguageCode) => void;
}) {
  const { t } = useT();

  return (
    <div className="flex gap-1.5">
      {ORDER.map((language) => {
        const selected = value.includes(language);
        return (
          <button key={language} type="button" aria-pressed={selected} onClick={() => onToggle(language)} className="chip chip-sm font-medium">
            {selected && <Check className="size-3" strokeWidth={2.2} />}
            {t(LABELS[language])}
          </button>
        );
      })}
    </div>
  );
}
