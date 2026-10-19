// Three WEF futures. Selecting one asks the page to re-rank role cards.
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  const [stacked, setStacked] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setStacked(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  function select(id: ScenarioId) {
    onChange(id);
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = SCENARIO_IDS.length - 1;
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(SCENARIO_IDS[nextIndex]);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-[12px] text-grey">Scenario</span>
      <div
        role="tablist"
        aria-label="Future scenario"
        aria-orientation={stacked ? "vertical" : "horizontal"}
        className="flex w-full flex-col items-stretch gap-0.5 rounded-xl bg-alt p-1 text-[13px] sm:w-auto sm:flex-row sm:items-center sm:overflow-x-auto"
      >
        {SCENARIO_IDS.map((id, index) => {
          const selected = value === id;
          const Icon = SCENARIO_ICON[id];
          return (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "inline-flex w-full shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 whitespace-nowrap sm:w-auto",
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
