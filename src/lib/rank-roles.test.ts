import { describe, expect, it } from "vitest";
import { rankRoles } from "./rank-roles";
import { isStretchRoute, STRETCH_FIT_THRESHOLD } from "./scoring";
import type { RoleResult } from "@/types/contracts";

const role = (occupationId: string, co: number, fit: number) =>
  ({ occupationId, fit, byScenario: { co, dis: co, sup: co } }) as RoleResult;

describe("rankRoles", () => {
  it("sorts strictly by scenario score, then occupationId ascending", () => {
    const ranked = rankRoles([role("b", 0.5, 0.1), role("c", 0.5, 0.3), role("a", 0.5, 0.1), role("d", 0.9, 0.05)], "co");
    expect(ranked.map((item) => item.occupationId)).toEqual(["d", "a", "b", "c"]);
  });

  it("has no near-tie epsilon: a visibly lower Fit does not jump a higher score", () => {
    const roles = [role("a", 0.411, 0.2), role("b", 0.408, 0.35)];
    expect(rankRoles(roles, "co").map((item) => item.occupationId)).toEqual(["a", "b"]);
    expect(rankRoles([role("a", 0.42, 0.2), role("b", 0.41, 0.2)], "co").map((item) => item.occupationId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("isStretchRoute", () => {
  it("flags fit below the threshold only", () => {
    expect(STRETCH_FIT_THRESHOLD).toBe(0.15);
    expect(isStretchRoute(0.149)).toBe(true);
    expect(isStretchRoute(0.15)).toBe(false);
  });
});
