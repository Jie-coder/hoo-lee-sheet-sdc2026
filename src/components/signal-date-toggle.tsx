// Signal snapshot switch: the same persona, scored 30 days apart.
"use client";

import { cn } from "@/lib/utils";

export const SIGNAL_DATES = ["thirty-days-ago", "today"] as const;
export type SignalDate = (typeof SIGNAL_DATES)[number];

const LABELS: Record<SignalDate, string> = {
  "thirty-days-ago": "30 days ago",
  today: "Today",
};

export function SignalDateToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: SignalDate;
  onChange: (value: SignalDate) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] whitespace-nowrap text-grey">Signal date</span>
      <div
        role="group"
        aria-label="Signal date"
        className="flex items-center rounded-lg border border-line p-0.5 text-[12px]"
      >
        {SIGNAL_DATES.map((date) => {
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
              {LABELS[date]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
