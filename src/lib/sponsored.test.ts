import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PERSONAS } from "@/mocks/personas";
import { analyzeProfile } from "./analyze";
import { CATALOGUE } from "./catalogue";
import { buildPathwayPlan } from "./pathway";
import { resolveProfileSkills } from "./profile-skills";
import { summariseFreeCost } from "./free-cost";
import {
  MAX_SPONSORED_PER_PATHWAY,
  MAX_SPONSORED_PER_STOP,
  freeReferenceIndex,
  SPONSORED_COURSES,
  pickSponsored,
  type SponsoredCourse,
} from "./sponsored";

const sc = (id: string, skillId: string): SponsoredCourse => ({
  id, title: id, provider: "Example Academy", skillId, skillLabel: skillId, price: "RM 1", listPrice: "RM 2", badges: [], url: "#",
});

describe("pickSponsored", () => {
  it("returns nothing when no stop closes a skill a sponsored course teaches", () => {
    expect(pickSponsored([{ itemId: "a", closesSkillIds: ["x"] }], ["x"], [sc("s1", "y")])).toEqual([]);
  });

  it("only matches skills that are in the role's gap", () => {
    expect(pickSponsored([{ itemId: "a", closesSkillIds: ["x"] }], [], [sc("s1", "x")])).toEqual([]);
  });

  it("never exceeds the per-stop and per-pathway caps", () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({ itemId: `i${i}`, closesSkillIds: ["a", "b", "c"] }));
    const catalogue = Array.from({ length: 12 }, (_, i) => sc(`s${i}`, ["a", "b", "c"][i % 3]));
    const picks = pickSponsored(steps, ["a", "b", "c"], catalogue);
    expect(MAX_SPONSORED_PER_STOP).toBe(1);
    expect(MAX_SPONSORED_PER_PATHWAY).toBe(3);
    expect(picks.length).toBe(MAX_SPONSORED_PER_PATHWAY);
    const perStop = new Map<number, number>();
    for (const pick of picks) perStop.set(pick.stopIndex, (perStop.get(pick.stopIndex) ?? 0) + 1);
    for (const count of perStop.values()) expect(count).toBeLessThanOrEqual(MAX_SPONSORED_PER_STOP);
    expect(new Set(picks.map((p) => p.course.id)).size).toBe(picks.length);
  });

  it("prefers non-adjacent stops", () => {
    const steps = Array.from({ length: 5 }, (_, i) => ({ itemId: `i${i}`, closesSkillIds: ["a"] }));
    const picks = pickSponsored(steps, ["a"], [sc("s1", "a"), sc("s2", "a"), sc("s3", "a")]);
    expect(picks.map((p) => p.stopIndex)).toEqual([0, 2, 4]);
  });

  it("mock partners are fictional data with non-navigating links, prices and badges", () => {
    for (const course of SPONSORED_COURSES) {
      expect(["Draviqen Academy", "Tamaskri Learning"]).toContain(course.provider);
      expect(course.url).toBe("#");
      expect(course.price).toMatch(/^RM \d+$/);
      expect(course.listPrice).toMatch(/^RM \d+$/);
      expect(course.badges.length).toBeGreaterThan(0);
    }
  });

  it("freeReferenceIndex finds a free stop for the skill and never falls back to a paid one", () => {
    const steps = [
      { closesSkillIds: ["a"], free: true },
      { closesSkillIds: ["b"], free: false },
      { closesSkillIds: ["a", "c"], free: false },
    ];
    expect(freeReferenceIndex(steps, "a")).toBe(0);
    expect(freeReferenceIndex(steps, "b")).toBe(-1);
    expect(freeReferenceIndex(steps, "c")).toBe(-1);
  });
});

describe("sponsored data stays out of the plan", () => {
  it("pathway, scoring and ranking modules do not import sponsored data", () => {
    for (const file of ["pathway.ts", "analyze.ts", "scoring.ts", "rank-roles.ts", "free-cost.ts", "programme-progress.ts", "pathway-print.ts"]) {
      expect(readFileSync(path.join(__dirname, file), "utf8")).not.toMatch(/sponsored/i);
    }
  });

  it("Jia Hui, Data scientist: plan, stops, weeks and free count are unchanged and 2-3 sponsored cards appear", () => {
    const persona = PERSONAS["lim-jia-hui"];
    const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
    const { skills } = resolveProfileSkills(CATALOGUE, persona.id, chips);
    const result = analyzeProfile(CATALOGUE, { skills, currentOccupationId: persona.currentOccupationId, impactInterest: "none" });
    const role = result.roles.find((r) => r.occupationId === "o010")!;
    const build = () =>
      buildPathwayPlan({
        role, courses: CATALOGUE.courses, programmes: CATALOGUE.programmes, studyLanguages: persona.courseLanguages,
        hoursPerWeek: 6, skillLinks: [], skillGroups: CATALOGUE.skillGroups, groupLabels: CATALOGUE.groupLabels,
      });
    const before = build();
    const snapshot = JSON.stringify(before);
    const picks = pickSponsored(before.steps, role.gap.map((g) => g.skillId));
    const after = build();
    expect(JSON.stringify(after)).toBe(snapshot);
    expect(JSON.stringify(before)).toBe(snapshot);
    const resolve = (id: string) => CATALOGUE.courses.find((c) => c.id === id) ?? CATALOGUE.programmes.find((p) => p.id === id) ?? null;
    expect(summariseFreeCost(after.steps.map((s) => resolve(s.itemId)))).toEqual(summariseFreeCost(before.steps.map((s) => resolve(s.itemId))));
    expect(picks.length).toBeGreaterThanOrEqual(2);
    expect(picks.length).toBeLessThanOrEqual(MAX_SPONSORED_PER_PATHWAY);
    for (const pick of picks) expect(after.steps[pick.stopIndex].closesSkillIds).toContain(pick.skillId);
  });
});
