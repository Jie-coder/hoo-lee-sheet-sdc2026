import { describe, expect, it } from "vitest";
import { ADOPTION_SPEED } from "./adoption";
import { ADOPTION_SPEED_STEPS, baseKeyOf, rolesRequest } from "./use-roles";
import type { FlowProfile } from "@/context/flow-context";

const profile = { personaId: "upload", skills: [{ label: "SQL", selfReported: true }], roles: [] } as unknown as FlowProfile;

describe("ADOPTION_SPEED_STEPS", () => {
  it("covers every slider position from min to max", () => {
    expect(ADOPTION_SPEED_STEPS[0]).toBe(ADOPTION_SPEED.min);
    expect(ADOPTION_SPEED_STEPS.at(-1)).toBe(ADOPTION_SPEED.max);
    expect(ADOPTION_SPEED_STEPS).toContain(ADOPTION_SPEED.default);
    expect(ADOPTION_SPEED_STEPS).toHaveLength(7);
  });
});

describe("baseKeyOf", () => {
  it("is the same for every slider position of the same profile", () => {
    const a = baseKeyOf(rolesRequest(profile, "none", "today", 0.5));
    const b = baseKeyOf(rolesRequest(profile, "none", "today", 2));
    expect(a).toBe(b);
  });

  it("differs when something other than the speed changes", () => {
    expect(baseKeyOf(rolesRequest(profile, "none", "today", 1))).not.toBe(
      baseKeyOf(rolesRequest(profile, "none", "prior", 1)),
    );
  });
});
