// "Change the data" test panel: rank with the active signal snapshot, then
// again with some skills' momentum overridden, all in the browser. Pure:
// nothing is sent or stored, so no other user sees it.
import { analyzeProfile } from "@/lib/analyze";
import type { Catalogue } from "@/lib/catalogue";
import { rankChanges, type RankChange } from "@/lib/compare-snapshots";
import { applyMomentumOverrides, applySignals, type MomentumOverride, type TrendSnapshot } from "@/lib/live-signals";
import { buildRadar } from "@/lib/radar";
import { PERSONAS, type PersonaId } from "@/mocks/personas";
import type { RoleResult, ScenarioId, SignalSnapshot } from "@/types/contracts";

export type PersonaRef = { id: string; currentOccupationId: string | null };
/** The panel opens on Aisyah; Jia Hui and Pravin are the other demo synthetic CVs. */
export const DEFAULT_OVERRIDE_PERSONA: PersonaId = "aisyah";

/** What rankPersona needs from a demo persona. */
export function personaRef(id: PersonaId): PersonaRef {
  const persona = PERSONAS[id];
  return { id: persona.id, currentOccupationId: persona.currentOccupationId };
}

export type SignalsInUse = { snapshot: SignalSnapshot; trend: TrendSnapshot };

function scored(catalogue: Catalogue, signals: SignalsInUse, overrides: readonly MomentumOverride[]): Catalogue {
  return applySignals(catalogue, applyMomentumOverrides(signals.snapshot, overrides), signals.trend.keywords);
}

/** The persona's roles, ranked for `scenario`, with these signals. */
export function rankPersona(
  catalogue: Catalogue,
  signals: SignalsInUse,
  persona: PersonaRef,
  scenario: ScenarioId,
  overrides: readonly MomentumOverride[] = [],
): RoleResult[] {
  const withSignals = scored(catalogue, signals, overrides);
  const skills = (withSignals.personaSkills[persona.id] ?? []).map((row) => ({ skillId: row.skillId, level: 1 }));
  const result = analyzeProfile(withSignals, { skills, currentOccupationId: persona.currentOccupationId, impactInterest: "none" });
  // Strictly by the score the panel displays. rankRoles() treats scores within
  // SCORE_TIE_EPSILON (0.005) as a tie and orders those by Fit, which is right for
  // the Fit-led result cards but looked wrong next to a 3-decimal score column.
  return [...result.roles].sort(
    (a, b) => b.byScenario[scenario] - a.byScenario[scenario] || (a.occupationId < b.occupationId ? -1 : a.occupationId > b.occupationId ? 1 : 0),
  );
}

export type OverrideComparison = { before: RoleResult[]; after: RoleResult[]; changes: RankChange[] };

export function compareOverride(
  catalogue: Catalogue,
  signals: SignalsInUse,
  persona: PersonaRef,
  scenario: ScenarioId,
  overrides: readonly MomentumOverride[],
): OverrideComparison {
  const before = rankPersona(catalogue, signals, persona, scenario);
  const after = overrides.length ? rankPersona(catalogue, signals, persona, scenario, overrides) : before;
  return { before, after, changes: rankChanges(before, after, scenario) };
}

/** The radar's "rising roles" (mean momentum of their essential skills), with these signals. */
export function risingRoleRanking(catalogue: Catalogue, signals: SignalsInUse, overrides: readonly MomentumOverride[] = []) {
  const radar = buildRadar(scored(catalogue, signals, overrides), "today");
  return radar ? radar.risingRoles.map((role) => ({ occupationId: role.occupationId, title: role.title, momentum: role.momentum })) : [];
}
