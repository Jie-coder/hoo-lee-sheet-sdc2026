// Client hook: asks POST /api/roles for the profile in the flow state.
// The answer only depends on the request, so it is cached for the tab's
// life and results -> pathway -> back does not call the API again.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RolesRequest, RolesResponse } from "@/app/api/roles/route";
import type { FlowProfile } from "@/context/flow-context";
import type { SignalDate } from "@/lib/analyze";
import type { ImpactInterest } from "@/types/contracts";

const cache = new Map<string, RolesResponse>();

export type RolesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: RolesResponse };

export function rolesRequest(
  profile: FlowProfile,
  impactInterest: ImpactInterest | undefined,
  signalDate: SignalDate = "today",
): RolesRequest {
  return {
    personaId: profile.personaId,
    skills: profile.skills.map((skill) => ({ label: skill.label, selfReported: skill.selfReported })),
    impactInterest: impactInterest ?? "none",
    signalDate,
    ...(profile.personaId === "upload" && profile.roles[0]?.title ? { currentJobTitle: profile.roles[0].title } : {}),
  };
}

export function useRoles(
  profile: FlowProfile | null,
  impactInterest: ImpactInterest | undefined,
  signalDate: SignalDate = "today",
) {
  const key = useMemo(
    () => (profile ? JSON.stringify(rolesRequest(profile, impactInterest, signalDate)) : null),
    [profile, impactInterest, signalDate],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (!key || cache.has(key) || errors[key]) return;
    let cancelled = false;
    fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: key })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        return body as RolesResponse;
      })
      .then((data) => {
        cache.set(key, data);
        if (!cancelled) setLoaded((count) => count + 1);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : String(error) }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, errors]);

  const retry = useCallback(() => {
    if (!key) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, [key]);

  let state: RolesState = { status: "loading" };
  const cached = key ? cache.get(key) : undefined;
  if (cached) state = { status: "ready", data: cached };
  else if (key && errors[key]) state = { status: "error", message: errors[key] };

  return { state, retry };
}
