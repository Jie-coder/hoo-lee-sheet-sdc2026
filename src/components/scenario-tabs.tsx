// Three WEF futures. Selecting one asks the page to re-rank role cards.
"use client";

import { useRef, useState, type KeyboardEvent } from "react";
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

/** One-sentence explanation shown in the small tooltip on hover, keyboard focus or tap. */
export const SCENARIO_TIP: Record<ScenarioId, MessageKey> = {
  co: "scenarioTabs.coTip",
  dis: "scenarioTabs.disTip",
  sup: "scenarioTabs.supTip",
};

export const SCENARIO_ILLUSTRATIVE: MessageKey = "scenarioTabs.illustrative";

export function ScenarioTabs({ value, onChange }: { value: ScenarioId; onChange: (scenario: ScenarioId) => void }) {
  const { t } = useT();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Which scenario's tooltip is showing: set by mouse hover, keyboard focus or a tap.
  const [tip, setTip] = useState<ScenarioId | null>(null);

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
    <div className="relative w-full sm:w-auto" onPointerLeave={(event) => event.pointerType === "mouse" && setTip(null)}>
    <div
      tabIndex={0}
      role="region"
      aria-label={t("scenarioTabs.ariaLabel")}
      className="w-full snap-x snap-mandatory overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)] [scrollbar-width:none] sm:w-auto sm:pr-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label={t("scenarioTabs.ariaLabel")}
        aria-orientation="horizontal"
        className="inline-flex w-max flex-row items-center gap-0.5 rounded-full bg-card p-1.5 text-[13px]"
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
              aria-describedby={tip === id ? "scenario-tip" : undefined}
              onClick={() => select(id)}
              onPointerEnter={(event) => event.pointerType === "mouse" && setTip(id)}
              onPointerDown={(event) => event.pointerType !== "mouse" && setTip(id)}
              onFocus={() => setTip(id)}
              onBlur={() => setTip(null)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "relative inline-flex shrink-0 snap-start items-center justify-center gap-1.5 rounded-full px-5 py-2.5 whitespace-nowrap transition-colors",
                selected ? "font-medium text-paper" : "text-grey hover:text-ink",
              )}
            >
              {selected && (
                <motion.span
                  layoutId="scenario-pill"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn("relative size-3.5", selected && "text-paper")} strokeWidth={1.6} />
              <span className="relative">{t(SCENARIO_LABEL[id])}</span>
            </button>
          );
        })}
      </div>
    </div>
      {tip && (
        <div
          id="scenario-tip"
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-2 line-clamp-2 w-max max-w-[min(320px,calc(100vw-2rem))] rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] leading-snug text-grey shadow-sm sm:right-0 sm:left-auto"
        >
          {t(SCENARIO_TIP[tip])}
        </div>
      )}
    </div>
  );
}
