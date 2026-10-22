// Keeps the feature map honest: this test fails when a page or data-testid is
// added without updating .claude/skills/laluan-feature-map (same as --check).
import { describe, expect, it } from "vitest";
import { buildMap, fileToRoute, findProblems, toMermaid } from "./generate";

describe("feature map", () => {
  it("turns page files into routes", () => {
    expect(fileToRoute("src/app/page.tsx".replace("src/app", process.cwd() + "/src/app"))).toBe("/");
  });

  it("finds the main pages and draws the journey arrows", () => {
    const map = buildMap();
    const routes = map.routes.map((r) => r.route);
    expect(routes).toEqual(expect.arrayContaining(["/", "/profile", "/interview", "/results", "/pathway"]));
    expect(toMermaid(map)).toContain("home --> profile");
  });

  it("is up to date (run npm run feature-map:render if this fails)", () => {
    expect(findProblems(buildMap())).toEqual([]);
  });
});
