// Formatting for scores and source dates. Bands come from the shared contracts.
import { scoreBand, type IsoDate, type UnitScore } from "@/types/contracts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function bandLabel(value: number): "Low" | "Medium" | "High" {
  const band = scoreBand(value);
  if (band === "low") return "Low";
  if (band === "high") return "High";
  return "Medium";
}

/** Band plus at most two decimals, e.g. "Medium · 0.48". */
export function formatBandScore(value: number): string {
  const parts = formatBandScoreParts(value);
  return `${parts.band} · ${parts.value}`;
}

export function formatBandScoreParts(value: number): { band: "Low" | "Medium" | "High"; value: string } {
  return { band: bandLabel(value), value: value.toFixed(2) };
}

export function formatFitPercent(fit: UnitScore): string {
  return `${Math.round(fit * 100)}%`;
}

/** "Sep 2026" from an ISO date. */
export function formatMonthYear(iso: IsoDate): string {
  const [year, month] = iso.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${name} ${year}`;
}

/** "19 Oct 2026" from an ISO date. */
export function formatDayMonthYear(iso: IsoDate): string {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${name} ${year}`;
}

/**
 * Source chips read "Dataset · Month Year". A date that is not the first of
 * the month (a daily signal such as arXiv) keeps the day.
 */
export function formatSourceDate(iso: IsoDate): string {
  if (iso.endsWith("-01")) return formatMonthYear(iso);
  return formatDayMonthYear(iso);
}
