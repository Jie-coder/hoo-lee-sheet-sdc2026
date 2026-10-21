// Signal snapshot switch: the same profile, ranked with arXiv counts from two
// dates about 30 days apart (data/keywords_prior.csv and data/keywords.csv).
// Same pill as the scenario tabs: a white highlight slides between options.
"use client";

import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import type { SignalDate } from "@/lib/analyze";
import { formatDayMonthYear, formatShortDate } from "@/lib/display";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/contracts";

const ORDER: SignalDate[] = ["prior", "today"];

export function SignalDateToggle({
  value,
  dates,
  onChange,
  disabled = false,
  layoutId = "signal-pill",
}: {
  value: SignalDate;
  dates: { today: IsoDate; prior: IsoDate | null };
  onChange: (value: SignalDate) => void;
  disabled?: boolean;
  /** Unique per page when the toggle appears more than once. */
  layoutId?: string;
}) {
  if (!dates.prior) {
    return <span className="tag">arXiv signal · {formatDayMonthYear(dates.today)}</span>;
  }
  const iso = (date: SignalDate) => (date === "today" ? dates.today : (dates.prior as IsoDate));

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[12px] whitespace-nowrap text-grey">
        <Activity className="size-3.5" strokeWidth={1.6} />
        arXiv signal
      </span>
      <div role="group" aria-label="Trend signal date" className="flex items-center gap-0.5 rounded-full bg-alt p-1 text-[13px]">
        {ORDER.map((date) => {
          const selected = value === date;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              aria-label={`${formatDayMonthYear(iso(date))}${date === "today" ? ", latest" : ", 30 days earlier"}`}
              disabled={disabled}
              onClick={() => onChange(date)}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors disabled:opacity-50",
                selected ? "font-medium text-ink" : "text-grey hover:text-ink",
              )}
            >
              {selected && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-full border border-line bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{formatShortDate(iso(date))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
