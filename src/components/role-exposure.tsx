// AI exposure line on a role card: a small signal light (green low, yellow
// medium, red high, grey while unknown) and a percentage, never a bar.
"use client";

import { useEffect, useState } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { catalogueExposure, fetchRoleExposure, lightTone, type LightTone, type RoleExposureState } from "@/lib/role-exposure";
import { cn } from "@/lib/utils";

const LIGHT_CLASS: Record<LightTone, string> = {
  low: "bg-signal-low",
  medium: "bg-signal-medium",
  high: "bg-signal-high",
  pending: "bg-signal-pending",
};

const LIGHT_LABEL: Record<LightTone, MessageKey> = {
  low: "exposure.lightLow",
  medium: "exposure.lightMedium",
  high: "exposure.lightHigh",
  pending: "exposure.lightPending",
};

export function SignalLight({ tone, className }: { tone: LightTone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full ring-[1.5px] ring-ink", LIGHT_CLASS[tone], className)}
    />
  );
}

export function useRoleExposure(occupationId: string, title: string): RoleExposureState {
  const local = catalogueExposure(occupationId);
  const [remote, setRemote] = useState<RoleExposureState>({ kind: "estimating" });
  useEffect(() => {
    if (local) return;
    let live = true;
    fetchRoleExposure(title).then((state) => live && setRemote(state));
    return () => {
      live = false;
    };
  }, [local, title]);
  return local ?? remote;
}

export function RoleExposureView({ state }: { state: RoleExposureState }) {
  const { t } = useT();
  const tone = lightTone(state);
  let body: string;
  if (state.kind === "score") {
    const parts = [`${Math.round(state.value * 100)}%`, state.sourceName];
    if (state.groupEstimate) parts.push(t("exposure.groupNote"));
    if (state.basedOn) parts.push(t("exposure.basedOn", { title: state.basedOn }));
    body = parts.join(" · ");
  } else if (state.kind === "no_close_match") {
    body = t("exposure.noCloseMatch");
  } else if (state.kind === "estimating") {
    body = t("exposure.estimating");
  } else {
    body = t("scoreCard.exposurePending");
  }
  return (
    <p className="mt-1 flex items-baseline gap-1.5 text-[13px] text-grey" data-exposure-state={state.kind}>
      <SignalLight tone={tone} className="translate-y-px" />
      <span>
        <span className="sr-only">{t(LIGHT_LABEL[tone])}: </span>
        {state.kind === "unavailable" ? body : `${t("roleCard.aiExposure")} · ${body}`}
      </span>
    </p>
  );
}

export function RoleExposure({ occupationId, title }: { occupationId: string; title: string }) {
  return <RoleExposureView state={useRoleExposure(occupationId, title)} />;
}
