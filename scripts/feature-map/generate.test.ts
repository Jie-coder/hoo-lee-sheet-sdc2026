// Keeps the feature map honest: this test fails when a page or data-testid is
// added without updating .claude/skills/laluan-feature-map (same as --check),
// and checks the scanner reads real labels, guards and data sources.
import { describe, expect, it } from "vitest";
import { buildMap, fileToRoute, findProblems, toMermaid, toPageMermaid } from "./generate";

describe("feature map", () => {
  const map = buildMap();
  const route = (r: string) => map.routes.find((x) => x.route === r)!;

  it("turns page files into routes", () => {
    expect(fileToRoute("src/app/page.tsx".replace("src/app", process.cwd() + "/src/app"))).toBe("/");
  });

  it("finds the main pages and the journey", () => {
    expect(map.routes.map((r) => r.route)).toEqual(expect.arrayContaining(["/", "/profile", "/interview", "/results", "/pathway"]));
    const start = route("/").elements.find((e) => e.testId === "landing-start")!;
    expect(start).toMatchObject({ label: "Start", kind: "button", navigatesTo: ["/profile"] });
    // The overview draws the journey click as a thick (==>) edge into a decision.
    expect(toMermaid(map)).toMatch(/home_e\d+ ==>\|"click Start"\| home_dec0/);
  });

  it("reads labels, conditions and guards from the components", () => {
    const interview = route("/interview");
    expect(interview.elements.find((e) => e.testId === "interview-next")?.label).toBe("See results / Next");
    expect(interview.elements.find((e) => e.testId === "interview-back")?.disabledWhen).toBe("turn === 1");
    expect(interview.elements.find((e) => e.section === "Hours a week")?.label).toBe("4 / 6 / 10 / 15 h");
    expect(interview.guards.map((g) => g.redirectTo)).toEqual(["/", "/profile"]);
    expect(route("/results").apiCalls).toEqual(["/api/roles"]);
  });

  it("finds where API data comes from", () => {
    const api = (r: string) => map.apiRoutes.find((a) => a.route === r)!.dataSources;
    expect(api("/api/analyze")).toEqual(expect.arrayContaining(["gemini", "mock-ai"]));
    expect(api("/api/items")).toEqual(["supabase-items"]);
    expect(toPageMermaid(map, route("/demo"))).toContain('api_analyze_dec0{"AI_MOCK=true?"}');
  });

  it("is up to date (run npm run feature-map:render if this fails)", () => {
    expect(findProblems(map)).toEqual([]);
  });
});
