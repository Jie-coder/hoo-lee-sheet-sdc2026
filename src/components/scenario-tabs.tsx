// Three WEF futures. Selecting one asks the page to re-rank role cards.
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
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
  co: "AI spreads steadily and mostly works alongside people. Digital, data and green roles grow; routine clerical work shrinks.",
  dis: "AI moves faster than people can retrain. Every field grows less, clerical work shrinks most, and AI exposure counts for more.",
  sup: "AI advances fast and people are ready for it. Digital and data roles grow fastest.",
};

export const SCENARIO_ILLUSTRATIVE =
  "Demand uses DOSM employment (2025) and WEF Future of Jobs 2025 figures. Scenarios follow WEF Four Futures (2026).";

export function ScenarioTabs({ value, onChange }: { value: ScenarioId; onChange: (scenario: ScenarioId) => void }) {
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
    <div
      role="tablist"
      aria-label="Future scenario"
      aria-orientation={stacked ? "vertical" : "horizontal"}
      className="flex w-full flex-col gap-0.5 rounded-full bg-alt p-1 text-[13px] sm:w-auto sm:flex-row sm:items-center"
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
            data-testid={`scenario-tab-${id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors sm:w-auto",
              selected ? "font-medium text-ink" : "text-grey hover:text-ink",
            )}
          >
            {selected && (
              <motion.span
                layoutId="scenario-pill"
                className="absolute inset-0 rounded-full border border-line bg-white shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className={cn("relative size-3.5", selected && "text-sage")} strokeWidth={1.6} />
            <span className="relative">{SCENARIO_LABEL[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
