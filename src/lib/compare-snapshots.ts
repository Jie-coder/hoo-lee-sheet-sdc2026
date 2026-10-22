// What changed between two rankings of the same profile, ranked with arXiv
// snapshots ~30 days apart. Used for the "what changed" line on /results,
// so a viewer can see the output move when the trend data moves.
import { rankRoles } from "@/lib/rank-roles";
import type { RoleResult, ScenarioId } from "@/types/contracts";

export type RankChange = {
  occupationId: string;
  title: string;
  /** 1-based rank in each snapshot; null when the role isn't in that snapshot's list. */
  before: number | null;
  after: number | null;
};

/** Every role whose rank differs between `before` and `after` in `scenario`, biggest move first. */
export function rankChanges(
  before: readonly RoleResult[],
  after: readonly RoleResult[],
  scenario: ScenarioId,
): RankChange[] {
  const rank = (roles: readonly RoleResult[]) =>
    new Map(rankRoles(roles, scenario).map((role, index) => [role.occupationId, { title: role.title, rank: index + 1 }]));
  const was = rank(before);
  const now = rank(after);
  const ids = new Set([...was.keys(), ...now.keys()]);

  const changes: RankChange[] = [];
  for (const id of ids) {
    const a = was.get(id)?.rank ?? null;
    const b = now.get(id)?.rank ?? null;
    if (a === b) continue;
    changes.push({ occupationId: id, title: (now.get(id) ?? was.get(id))!.title, before: a, after: b });
  }
  const size = (change: RankChange) =>
    change.before == null || change.after == null ? Number.POSITIVE_INFINITY : Math.abs(change.before - change.after);
  return changes.sort((x, y) => size(y) - size(x) || x.title.localeCompare(y.title));
}

/** "Data analyst #3 → #2" / "Energy assessor: new in the list" / "Cashier: drops out of the list". */
export function describeChange(change: RankChange): string {
  if (change.before == null) return `${change.title}: new in the list at #${change.after}`;
  if (change.after == null) return `${change.title}: drops out of the list (was #${change.before})`;
  return `${change.title} #${change.before} → #${change.after}`;
}

/** Short form for one-line summaries: "Software developer new at #6", "BI manager out", "Energy assessor #6 → #5". */
export function describeChangeShort(change: RankChange): string {
  if (change.before == null) return `${change.title} new at #${change.after}`;
  if (change.after == null) return `${change.title} out`;
  return `${change.title} #${change.before} → #${change.after}`;
}
