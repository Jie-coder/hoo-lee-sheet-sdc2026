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
