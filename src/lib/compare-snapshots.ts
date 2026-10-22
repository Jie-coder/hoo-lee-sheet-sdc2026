// What changed between two rankings of the same profile, ranked with arXiv
// snapshots ~30 days apart. Used for the "what changed" line on /results,
// so a viewer can see the output move when the trend data moves.
import { translate, type MessageKey } from "@/lib/i18n-messages";
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

type Translate = (key: MessageKey, vars?: Record<string, string>) => string;
const defaultT: Translate = (key, vars) => translate("en", key, vars);

/** "Data analyst #3 → #2" / "Energy assessor: new in the list" / "Cashier: drops out of the list". */
export function describeChange(change: RankChange, t: Translate = defaultT): string {
  if (change.before == null) return t("compare.newInList", { title: change.title, rank: String(change.after) });
  if (change.after == null) return t("compare.dropsOut", { title: change.title, rank: String(change.before) });
  return t("compare.move", {
    title: change.title,
    before: String(change.before),
    after: String(change.after),
  });
}

/** Short form for one-line summaries: "Software developer new at #6", "BI manager out", "Energy assessor #6 → #5". */
export function describeChangeShort(change: RankChange, t: Translate = defaultT): string {
  if (change.before == null) return t("results.changeNewShort", { title: change.title, rank: String(change.after) });
  if (change.after == null) return t("results.changeOut", { title: change.title });
  return t("results.changeMove", {
    title: change.title,
    before: String(change.before),
    after: String(change.after),
  });
}
