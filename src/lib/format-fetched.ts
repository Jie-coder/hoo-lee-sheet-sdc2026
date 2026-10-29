// Fetch timestamps for the trend line: date via the app's month names, time in Malaysia (MYT).
import { formatDayMonthYear } from "@/lib/display";
import type { MessageKey } from "@/lib/i18n-messages";
import type { IsoDate } from "@/types/contracts";

type Translate = (key: MessageKey, vars?: Record<string, string>) => string;
const ZONE = "Asia/Kuala_Lumpur";

export function fetchedParts(iso: string, t: Translate): { date: string; time: string } {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return { date: iso, time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}` as IsoDate;
  return { date: formatDayMonthYear(date, t), time: `${get("hour")}:${get("minute")}` };
}
