// Finals freeze: when TREND_REFRESH_LOCKED is "1" or "true", POST
// /api/refresh-signals stores nothing and the Refresh button is disabled, so
// the demo keeps ranking with the saved snapshot. A request whose
// x-refresh-key header matches TREND_REFRESH_KEY (only if that is set) may
// still refresh. Server-only: neither value ever reaches the browser or a log.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export const REFRESH_LOCKED_MESSAGE = "Trend data is frozen for the finals; showing the saved snapshot.";

export function isRefreshLocked(): boolean {
  return ["1", "true"].includes((process.env.TREND_REFRESH_LOCKED ?? "").trim().toLowerCase());
}

/** True only when TREND_REFRESH_KEY is set and the request's x-refresh-key matches it (constant time). */
export function hasRefreshKey(request: Request): boolean {
  const expected = process.env.TREND_REFRESH_KEY;
  const given = request.headers.get("x-refresh-key");
  if (!expected || !given) return false;
  // Hash both so the comparison is fixed-length and leaks neither length nor content.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
