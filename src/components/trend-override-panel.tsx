// "Change the data" test panel for judges: override one skill's momentum
// in the active signal snapshot and see role rankings change at once. Everything runs in
// this browser tab (src/lib/trend-override.ts); nothing is sent or saved.
"use client";

import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { CATALOGUE } from "@/lib/catalogue";
import { describeChangeShort } from "@/lib/compare-snapshots";
import { useT } from "@/lib/i18n";
import type { MomentumOverride } from "@/lib/live-signals";
import { compareOverride, DEFAULT_OVERRIDE_PERSONA, personaRef, risingRoleRanking, type SignalsInUse } from "@/lib/trend-override";
import { PERSONA_IDS, PERSONAS, type PersonaId } from "@/mocks/personas";

const MAX_MOMENTUM = 10;

function signed(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(2)}`;
}

function clampMomentum(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_MOMENTUM, Math.max(-MAX_MOMENTUM, Math.round(value * 100) / 100));
}

function RankList({ title, items, testId }: { title: string; items: { id: string; label: string; value: string }[]; testId: string }) {
  const { t } = useT();
  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] tracking-[0.06em] text-grey uppercase">{title}</p>
      {items.length ? (
        <ol data-testid={testId} className="mt-2 space-y-1 text-[14px]">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate first-letter:uppercase">
                <span className="font-mono text-[12px] text-grey">#{index + 1}</span> {item.label}
              </span>
              <span className="shrink-0 font-mono text-[12px] text-grey tabular-nums">{item.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-[14px] text-grey">{t("override.none")}</p>
      )}
    </div>
  );
}

export function TrendOverridePanel({ signals }: { signals: SignalsInUse }) {
  const { t } = useT();
  const readings = useMemo(
    () =>
      [...signals.snapshot.signals]
        .map((reading) => ({
          ...reading,
          label: CATALOGUE.skills[reading.skillId] ?? reading.skillId,
          roles: CATALOGUE.occupations.filter((occupation) => occupation.essentialSkillIds.includes(reading.skillId)).length,
        }))
        // Only skills some role needs can move a ranking; the most-used skill comes first.
        .filter((reading) => reading.roles > 0)
        .sort((a, b) => b.roles - a.roles || a.label.localeCompare(b.label)),
    [signals],
  );
  const [selected, setSelected] = useState(readings[0]?.skillId ?? "");
  const base = readings.find((reading) => reading.skillId === selected) ?? readings[0];
  const [override, setOverride] = useState<MomentumOverride | null>(null);
  const [personaId, setPersonaId] = useState<PersonaId>(DEFAULT_OVERRIDE_PERSONA);
  const PERSONA = PERSONAS[personaId];
  const active = override && override.skillId === base?.skillId ? override : null;
  const momentum = active?.momentum ?? base?.value ?? 0;
  const overrides = useMemo(() => (active ? [active] : []), [active]);

  const persona = useMemo(
    () => compareOverride(CATALOGUE, signals, personaRef(personaId), "co", overrides),
    [signals, overrides, personaId],
  );
  const risingBefore = useMemo(() => risingRoleRanking(CATALOGUE, signals), [signals]);
  const risingAfter = useMemo(() => risingRoleRanking(CATALOGUE, signals, overrides), [signals, overrides]);
  const risingChanged =
    risingBefore.map((role) => role.occupationId).join() !== risingAfter.map((role) => role.occupationId).join();

  if (!base) return null;
  const set = (value: number) => setOverride({ skillId: base.skillId, momentum: clampMomentum(value) });

  const roleItems = (roles: typeof persona.before) =>
    roles.slice(0, 5).map((role) => ({ id: role.occupationId, label: role.title, value: role.byScenario.co.toFixed(3) }));
  const risingItems = (roles: typeof risingBefore) =>
    roles.map((role) => ({ id: role.occupationId, label: role.title, value: signed(role.momentum) }));
  const changes = persona.changes.map((change) => describeChangeShort(change, t));

  return (
    <section
      id="change-the-data"
      data-testid="trend-override"
      aria-labelledby="override-title"
      className="mt-4 rounded-[40px] border-2 border-dashed border-plasma bg-card p-8 md:p-12"
    >
      <p className="flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-plasma uppercase">
        <FlaskConical className="size-4" strokeWidth={1.6} />
        {t("override.eyebrow")}
        {active && <span className="rounded-full bg-plasma px-2.5 py-0.5 text-card">{t("override.active")}</span>}
      </p>
      <h2 id="override-title" className="mt-3 font-serif text-[clamp(28px,4vw,44px)] leading-[0.9] uppercase">
        {t("override.title")}
      </h2>
      <p className="mt-4 max-w-[680px] text-[16px] leading-relaxed text-grey">{t("override.lede")}</p>
      <p role="note" className="mt-3 max-w-[680px] rounded-lg bg-sulfur px-3 py-2 text-[13px] font-medium">
        {t("override.notice")}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-[13px]">
          {t("override.persona")}
          <select
            data-testid="override-persona"
            value={personaId}
            onChange={(event) => setPersonaId(event.target.value as PersonaId)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[15px]"
          >
            {PERSONA_IDS.map((id) => (
              <option key={id} value={id}>
                {PERSONAS[id].name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          {t("override.keyword")}
          <select
            data-testid="override-keyword"
            value={base.skillId}
            onChange={(event) => {
              setSelected(event.target.value);
              setOverride(null);
            }}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[15px]"
          >
            {readings.map((reading) => (
              <option key={reading.skillId} value={reading.skillId}>
                {reading.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          {t("override.recent", { value: signed(base.value) })}
          <input
            data-testid="override-momentum-input"
            type="number"
            step={0.1}
            min={-MAX_MOMENTUM}
            max={MAX_MOMENTUM}
            value={momentum}
            onChange={(event) => set(Number(event.target.value))}
            className="rounded-lg border border-line bg-white px-3 py-2 font-mono text-[15px] tabular-nums"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] tabular-nums" data-testid="override-momentum">
          {t("override.momentum", { before: signed(base.value), after: signed(momentum) })}
        </span>
        <button type="button" data-testid="override-surge" onClick={() => set(momentum + 1)} className="rounded-lg border border-line bg-btn2 px-3 py-1.5 text-[13px] font-medium">
          {t("override.surge")}
        </button>
        <button type="button" data-testid="override-crash" onClick={() => set(momentum - 1)} className="rounded-lg border border-line bg-btn2 px-3 py-1.5 text-[13px] font-medium">
          {t("override.crash")}
        </button>
        <button
          type="button"
          data-testid="override-reset"
          onClick={() => setOverride(null)}
          disabled={!active}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.6} />
          {t("override.reset")}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-[24px] bg-paper p-5">
          <p className="text-[16px] font-bold">{t("override.risingHeading")}</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RankList title={t("override.before")} items={risingItems(risingBefore)} testId="override-rising-before" />
            <RankList title={t("override.after")} items={risingItems(risingAfter)} testId="override-rising-after" />
          </div>
          {active && !risingChanged && <p className="mt-3 text-[13px] text-grey">{t("override.noChange")}</p>}
        </div>
        <div className="rounded-[24px] bg-paper p-5">
          <p className="text-[16px] font-bold">{t("override.personaHeading", { name: PERSONA.name })}</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RankList title={t("override.before")} items={roleItems(persona.before)} testId="override-persona-before" />
            <RankList title={t("override.after")} items={roleItems(persona.after)} testId="override-persona-after" />
          </div>
          {active && (
            <p className="mt-3 text-[13px] text-grey" data-testid="override-changes">
              {changes.length ? `${t("override.changes")}: ${changes.join("; ")}` : t("override.noChange")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
