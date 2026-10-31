// Client hook: asks POST /api/roles for the profile in the flow state.
// The answer only depends on the request, so it is cached for the tab's
// life and results -> pathway -> back does not call the API again.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RolesRequest, RolesResponse } from "@/app/api/roles/route";
import type { FlowProfile } from "@/context/flow-context";
import type { SignalDate } from "@/lib/analyze";
import { ADOPTION_SPEED } from "@/lib/adoption";
import type { ImpactInterest } from "@/types/contracts";

const cache = new Map<string, RolesResponse>();
// Last answer per request ignoring adoptionSpeed, so moving the slider keeps the
// previous sections on screen (marked stale) instead of dropping to a skeleton.
const lastByBase = new Map<string, RolesResponse>();
const inflight = new Map<string, Promise<RolesResponse>>();

/** Forget cached rankings, e.g. after a trend refresh changed the data they were built from. */
export function clearRolesCache() {
  cache.clear();
  lastByBase.clear();
}

/** The request key without the slider value: identifies "the same page, different speed". */
export function baseKeyOf(request: RolesRequest): string {
  return JSON.stringify({ ...request, adoptionSpeed: undefined });
}

function loadRoles(key: string): Promise<RolesResponse> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: key })
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
      const data = body as RolesResponse;
      cache.set(key, data);
      lastByBase.set(baseKeyOf(JSON.parse(key) as RolesRequest), data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Every slider position, so they can be fetched ahead of the user reaching them. */
export const ADOPTION_SPEED_STEPS: number[] = [];
for (let v = ADOPTION_SPEED.min; v <= ADOPTION_SPEED.max + 1e-9; v += ADOPTION_SPEED.step) ADOPTION_SPEED_STEPS.push(v);

export type RolesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: RolesResponse; stale: boolean };

export function rolesRequest(
  profile: FlowProfile,
  impactInterest: ImpactInterest | undefined,
  signalDate: SignalDate = "today",
  adoptionSpeed: number = 1,
): RolesRequest {
  return {
    personaId: profile.personaId,
    skills: profile.skills.map((skill) => ({ label: skill.label, selfReported: skill.selfReported })),
    impactInterest: impactInterest ?? "none",
    signalDate,
    adoptionSpeed,
    ...(profile.personaId === "upload" && profile.roles[0]?.title ? { currentJobTitle: profile.roles[0].title } : {}),
  };
}

export function useRoles(
  profile: FlowProfile | null,
  impactInterest: ImpactInterest | undefined,
  signalDate: SignalDate = "today",
  adoptionSpeed: number = 1,
) {
  const key = useMemo(
    () => (profile ? JSON.stringify(rolesRequest(profile, impactInterest, signalDate, adoptionSpeed)) : null),
    [profile, impactInterest, signalDate, adoptionSpeed],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (!key || cache.has(key) || errors[key]) return;
    let cancelled = false;
    loadRoles(key)
      .then(() => {
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

  // Once the current answer is in, warm the other slider positions so later
  // moves are served from the cache with no network wait.
  const ready = key ? cache.has(key) : false;
  useEffect(() => {
    if (!ready || !profile) return;
    const base = rolesRequest(profile, impactInterest, signalDate, adoptionSpeed);
    for (const speed of ADOPTION_SPEED_STEPS) {
      const other = JSON.stringify({ ...base, adoptionSpeed: speed });
      if (!cache.has(other)) loadRoles(other).catch(() => {});
    }
  }, [ready, profile, impactInterest, signalDate, adoptionSpeed]);

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
  const previous = profile ? lastByBase.get(baseKeyOf(rolesRequest(profile, impactInterest, signalDate))) : undefined;
  if (cached) state = { status: "ready", data: cached, stale: false };
  else if (key && errors[key]) state = { status: "error", message: errors[key] };
  else if (previous) state = { status: "ready", data: previous, stale: true };

  return { state, retry };
}
