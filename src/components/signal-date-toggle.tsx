// Signal snapshot switch: the same profile, ranked with arXiv counts from two
// dates about 30 days apart (data/keywords_prior.csv and data/keywords.csv).
"use client";

import type { SignalDate } from "@/lib/analyze";
import { formatDayMonthYear } from "@/lib/display";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/contracts";

const ORDER: SignalDate[] = ["prior", "today"];

export function SignalDateToggle({
  value,
  dates,
  onChange,
  disabled = false,
}: {
  value: SignalDate;
  dates: { today: IsoDate; prior: IsoDate | null };
  onChange: (value: SignalDate) => void;
  disabled?: boolean;
}) {
  if (!dates.prior) {
    return (
      <span className="text-[12px] whitespace-nowrap text-grey">
        Trend signal: arXiv counts checked {formatDayMonthYear(dates.today)}
      </span>
    );
  }
  const label = (date: SignalDate) =>
    date === "today"
      ? `${formatDayMonthYear(dates.today)} · latest`
      : `${formatDayMonthYear(dates.prior as IsoDate)} · 30 days earlier`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] whitespace-nowrap text-grey">arXiv trend signal from</span>
      <div
        role="group"
        aria-label="Trend signal date"
        className="flex items-center rounded-lg border border-line p-0.5 text-[12px]"
      >
        {ORDER.map((date) => {
          const selected = value === date;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(date)}
              className={cn(
                "rounded-md px-2.5 py-1 whitespace-nowrap disabled:opacity-50",
                selected ? "bg-ink font-medium text-white" : "text-grey",
              )}
            >
              {label(date)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
