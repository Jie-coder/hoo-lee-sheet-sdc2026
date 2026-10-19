// Three WEF futures. Selecting one asks the page to re-rank role cards.
"use client";

import { TrendingDown, Users, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCENARIO_IDS, type ScenarioId } from "@/types/contracts";

export const SCENARIO_LABEL: Record<ScenarioId, string> = {
  co: "Co-Pilot Economy",
  dis: "Age of Displacement",
  sup: "Supercharged Progress",
};

const SCENARIO_ICON: Record<ScenarioId, LucideIcon> = {
  co: Users,
  dis: TrendingDown,
  sup: Zap,
};

export const SCENARIO_SUMMARY: Record<ScenarioId, string> = {
  co: "AI spreads steadily and mostly works alongside people. Demand grows for data and customer roles; routine clerical work shrinks slowly.",
  dis: "AI replaces routine tasks faster than new work appears. Clerical demand falls sharply, and some customer roles slip down the ranking.",
  sup: "AI capability jumps quickly. Demand surges for digital and data work, and green reporting grows with it.",
};

export const SCENARIO_ILLUSTRATIVE =
  "Scenario values are illustrative, based on WEF Jobs of Tomorrow futures.";

export function ScenarioTabs({
  value,
  onChange,
}: {
  value: ScenarioId;
  onChange: (scenario: ScenarioId) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 text-[12px] text-grey">Scenario</span>
      <div
        role="tablist"
        aria-label="Future scenario"
        className="flex items-center gap-0.5 overflow-x-auto rounded-xl bg-alt p-1 text-[13px]"
      >
        {SCENARIO_IDS.map((id) => {
          const selected = value === id;
          const Icon = SCENARIO_ICON[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 whitespace-nowrap",
                selected
                  ? "border border-line bg-white font-medium text-ink shadow-sm"
                  : "text-grey",
              )}
            >
              <Icon className={cn("size-3.5", selected && "text-sage")} strokeWidth={1.6} />
              {SCENARIO_LABEL[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
