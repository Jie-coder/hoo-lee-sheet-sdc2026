// Helpers for the Pathway "Download PDF" ticket (window.print surface in
// pathway-view.tsx). Pure, so the ticket reads the same in tests and print.

/**
 * Ticket number shown on the printed pathway, e.g. "PATH-0427".
 * Deterministic from the role id (FNV-1a 32-bit hash, mod 10 000) so the same
 * role always prints the same number. It is decorative: nothing is stored and
 * it is not a verification or booking reference.
 */
export function pathwayTicketNumber(roleId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < roleId.length; i += 1) {
    hash ^= roleId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `PATH-${String(hash % 10000).padStart(4, "0")}`;
}

/** A course link without the scheme or "www.", cut to `max` characters with "…". */
export function shortCourseUrl(url: string, max = 48): string {
  const bare = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

/** Which leg of the route a stop is: the first boards, the last arrives. */
export function pathwayStopLeg(index: number, total: number): "board" | "arrive" | "skillUp" {
  if (index === 0) return "board";
  if (index === total - 1) return "arrive";
  return "skillUp";
}

/** SDG goal numbers ("8.5" → 8) from target ids, unique and ascending. */
export function sdgGoalNumbers(targets: readonly string[]): number[] {
  const goals = targets
    .map((target) => Number.parseInt(target.split(".")[0] ?? "", 10))
    .filter((goal) => Number.isFinite(goal));
  return [...new Set(goals)].sort((a, b) => a - b);
}
