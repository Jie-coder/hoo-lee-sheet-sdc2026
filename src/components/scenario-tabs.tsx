// Three WEF futures. Selecting one asks the page to re-rank role cards.
"use client";

import { useRef, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Users, Zap, type LucideIcon } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SCENARIO_IDS, type ScenarioId } from "@/types/contracts";

export const SCENARIO_LABEL: Record<ScenarioId, MessageKey> = {
  co: "scenarioTabs.coLabel",
  dis: "scenarioTabs.disLabel",
  sup: "scenarioTabs.supLabel",
};

const SCENARIO_ICON: Record<ScenarioId, LucideIcon> = {
  co: Users,
  dis: TrendingDown,
  sup: Zap,
};

export const SCENARIO_SUMMARY: Record<ScenarioId, MessageKey> = {
  co: "scenarioTabs.coSummary",
  dis: "scenarioTabs.disSummary",
  sup: "scenarioTabs.supSummary",
};

export const SCENARIO_ILLUSTRATIVE: MessageKey = "scenarioTabs.illustrative";

export function ScenarioTabs({ value, onChange }: { value: ScenarioId; onChange: (scenario: ScenarioId) => void }) {
  const { t } = useT();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
    <div className="w-full overflow-x-auto [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label={t("scenarioTabs.ariaLabel")}
        aria-orientation="horizontal"
        className="inline-flex w-max flex-row items-center gap-0.5 rounded-full bg-alt p-1 text-[13px]"
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
                "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors",
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
              <span className="relative">{t(SCENARIO_LABEL[id])}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
