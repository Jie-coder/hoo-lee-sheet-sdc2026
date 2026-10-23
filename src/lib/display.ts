// Formatting for scores and source dates. Bands come from the shared contracts.
import { translate, type MessageKey } from "@/lib/i18n-messages";
import { scoreBand, type IsoDate, type UnitScore } from "@/types/contracts";

type Translate = (key: MessageKey, vars?: Record<string, string>) => string;
const defaultT: Translate = (key, vars) => translate("en", key, vars);

const MONTH_KEYS: ReadonlyArray<MessageKey> = [
  "display.monthJan",
  "display.monthFeb",
  "display.monthMar",
  "display.monthApr",
  "display.monthMay",
  "display.monthJun",
  "display.monthJul",
  "display.monthAug",
  "display.monthSep",
  "display.monthOct",
  "display.monthNov",
  "display.monthDec",
];

export function bandMessageKey(value: number): MessageKey {
  const band = scoreBand(value);
  if (band === "low") return "display.bandLow";
  if (band === "high") return "display.bandHigh";
  return "display.bandMedium";
}

export function bandLabel(value: number, t: Translate = defaultT): string {
  return t(bandMessageKey(value));
}

/** Band plus at most two decimals, e.g. "Medium · 0.48". */
export function formatBandScore(value: number, t: Translate = defaultT): string {
  const parts = formatBandScoreParts(value, t);
  return `${parts.band} · ${parts.value}`;
}

export function formatBandScoreParts(value: number, t: Translate = defaultT): { band: string; value: string } {
  return { band: bandLabel(value, t), value: value.toFixed(2) };
}

export function formatFitPercent(fit: UnitScore): string {
  return `${Math.round(fit * 100)}%`;
}

/**
 * A missing number renders as a bracketed `[placeholder]` in development so it
 * is obvious in review, and as the given "Not available yet" copy in production.
 * Never invent a value (spec §0 "Data honesty").
 */
export function missingValue(notAvailableLabel: string): string {
  return process.env.NODE_ENV === "production" ? notAvailableLabel : "[placeholder]";
}

/** One line reading the augmentation band, for the always-visible spot the long definition left. */
export function augmentationSummary(value: UnitScore, t: Translate = defaultT): string {
  const band = scoreBand(value);
  if (band === "high") return t("display.augmentationHigh");
  if (band === "medium") return t("display.augmentationMedium");
  return t("display.augmentationLow");
}

/** "Sep 2026" from an ISO date. */
export function formatMonthYear(iso: IsoDate, t: Translate = defaultT): string {
  const [year, month] = iso.split("-");
  const key = MONTH_KEYS[Number(month) - 1];
  const name = key ? t(key) : month;
  return `${name} ${year}`;
}

/** "19 Oct 2026" from an ISO date. */
export function formatDayMonthYear(iso: IsoDate, t: Translate = defaultT): string {
  const [year, month, day] = iso.split("-");
  const key = MONTH_KEYS[Number(month) - 1];
  const name = key ? t(key) : month;
  return `${Number(day)} ${name} ${year}`;
}

/**
 * Source chips read "Dataset · Month Year". A date that is not the first of
 * the month (a daily signal such as arXiv) keeps the day.
 */
export function formatSourceDate(iso: IsoDate, t: Translate = defaultT): string {
  if (iso.endsWith("-01")) return formatMonthYear(iso, t);
  return formatDayMonthYear(iso, t);
}

/** "19 Sep" from an ISO date: for tight controls where the year is obvious. */
export function formatShortDate(iso: IsoDate, t: Translate = defaultT): string {
  const [, month, day] = iso.split("-");
  const key = MONTH_KEYS[Number(month) - 1];
  const name = key ? t(key) : month;
  return `${Number(day)} ${name}`;
}
