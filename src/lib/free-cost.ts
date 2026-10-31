// Accurate "how much of this pathway is free" figure, counted from the cost
// tags of the pathway's catalogue items. Replaces the vague "mostly free" label.
import { COST_TYPES, type CostType } from "@/types/contracts";

export type FreeCostSummary = {
  total: number;
  free: number;
  /** Items whose cost is missing or not a known cost tag. Never counted as free. */
  unknown: number;
  /** Free share of all items (unknown included in the denominator), rounded 0-100. */
  percent: number;
};

type CostedItem = { costType?: string | null } | null | undefined;

function isCostType(value: unknown): value is CostType {
  return (COST_TYPES as readonly unknown[]).includes(value);
}

/** Count free vs unknown-cost items. An unresolved item (null/undefined) is unknown. */
export function summariseFreeCost(items: readonly CostedItem[]): FreeCostSummary {
  let free = 0;
  let unknown = 0;
  for (const item of items) {
    const cost = item?.costType;
    if (!isCostType(cost)) unknown += 1;
    else if (cost === "free") free += 1;
  }
  const total = items.length;
  return { total, free, unknown, percent: total === 0 ? 0 : Math.round((free / total) * 100) };
}

export type FreeCostMessage = {
  key:
    | "pathway.costNoStops"
    | "pathway.costAllUnknown"
    | "pathway.costAllFree"
    | "pathway.costNoneFree"
    | "pathway.costSomeFree"
    | "pathway.costUnknownCount";
  params: Record<string, string>;
};

/** Message keys (joined with " · " by the caller) that describe the summary. */
export function freeCostMessages(summary: FreeCostSummary): FreeCostMessage[] {
  const { total, free, unknown, percent } = summary;
  const counts = { free: String(free), total: String(total), percent: String(percent) };
  if (total === 0) return [{ key: "pathway.costNoStops", params: {} }];
  if (unknown === total) return [{ key: "pathway.costAllUnknown", params: { total: String(total) } }];

  const main: FreeCostMessage =
    free === total
      ? { key: "pathway.costAllFree", params: { total: String(total) } }
      : free === 0
        ? { key: "pathway.costNoneFree", params: { total: String(total) } }
        : { key: "pathway.costSomeFree", params: counts };
  return unknown > 0 ? [main, { key: "pathway.costUnknownCount", params: { unknown: String(unknown) } }] : [main];
}
