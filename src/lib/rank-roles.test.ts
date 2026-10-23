import { describe, expect, it } from "vitest";
import { rankRoles } from "./rank-roles";
import { isStretchRoute, STRETCH_FIT_THRESHOLD } from "./scoring";
import type { RoleResult } from "@/types/contracts";

const role = (occupationId: string, co: number, fit: number) =>
  ({ occupationId, fit, byScenario: { co, dis: co, sup: co } }) as RoleResult;

describe("rankRoles", () => {
  it("sorts by scenario score, then higher fit, then id", () => {
    const ranked = rankRoles([role("b", 0.5, 0.1), role("c", 0.5, 0.3), role("a", 0.5, 0.1), role("d", 0.9, 0.05)], "co");
    expect(ranked.map((item) => item.occupationId)).toEqual(["d", "c", "a", "b"]);
  });
});

describe("isStretchRoute", () => {
  it("flags fit below the threshold only", () => {
    expect(STRETCH_FIT_THRESHOLD).toBe(0.15);
    expect(isStretchRoute(0.149)).toBe(true);
    expect(isStretchRoute(0.15)).toBe(false);
  });
});

describe("rankRoles near-tie", () => {
  const r = (occupationId: string, score: number, fit: number) =>
    ({ occupationId, fit, byScenario: { co: score, dis: score, sup: score } }) as unknown as RoleResult;
  it("breaks scores within 0.005 by displayed Fit, but not wider gaps", () => {
    const roles = [r("a", 0.411, 0.2), r("b", 0.408, 0.2)];
    const shown = (role: RoleResult) => (role.occupationId === "b" ? 0.35 : role.fit);
    expect(rankRoles(roles, "co", shown).map((x) => x.occupationId)).toEqual(["b", "a"]);
    expect(rankRoles([r("a", 0.42, 0.2), r("b", 0.41, 0.2)], "co", shown).map((x) => x.occupationId)).toEqual(["a", "b"]);
    expect(rankRoles(roles, "co").map((x) => x.occupationId)).toEqual(["a", "b"]);
  });
});
