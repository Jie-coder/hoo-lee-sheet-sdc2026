import { describe, expect, it } from "vitest";
import type { Course, Programme } from "@/types/contracts";
import { buildPathwayPlan, filterCoursesByLanguage, pickCourseForSkill, programmeEligibilityStatus } from "./pathway";

function course(overrides: Partial<Course>): Course {
  return {
    id: "course-1",
    title: "Example course",
    provider: "Example provider",
    url: "https://example.com",
    languages: ["en"],
    hours: 6,
    costType: "free",
    certificate: false,
    skillIds: ["example-skill"],
    lastChecked: "2026-10-01",
    mode: "online",
    ...overrides,
  };
}

describe("course study-language filter", () => {
  const courses: Course[] = [
    course({ id: "en-only", languages: ["en"] }),
    course({ id: "ms-only", languages: ["ms"] }),
    course({ id: "zh-only", languages: ["zh"] }),
    course({ id: "en-ms", languages: ["en", "ms"] }),
  ];

  it("keeps only courses offered in one of the selected languages", () => {
    const result = filterCoursesByLanguage(courses, ["ms"]);
    expect(result.map((c) => c.id).sort()).toEqual(["en-ms", "ms-only"]);
  });

  it("matches a course offered in any of several selected languages", () => {
    const result = filterCoursesByLanguage(courses, ["zh", "ms"]);
    expect(result.map((c) => c.id).sort()).toEqual(["en-ms", "ms-only", "zh-only"]);
  });

  it("returns nothing when no course matches the selected languages", () => {
    const onlyZh = courses.filter((c) => c.id === "en-only");
    expect(filterCoursesByLanguage(onlyZh, ["zh"])).toEqual([]);
  });

  it("falls back to every course when no languages are selected", () => {
    expect(filterCoursesByLanguage(courses, [])).toHaveLength(courses.length);
  });

  it("picks the cheapest, shortest course that closes the skill and matches the language", () => {
    const pool: Course[] = [
      course({ id: "paid-short", skillIds: ["s1"], costType: "paid", hours: 2, languages: ["en"] }),
      course({ id: "free-long", skillIds: ["s1"], costType: "free", hours: 10, languages: ["en"] }),
      course({ id: "free-short-wrong-lang", skillIds: ["s1"], costType: "free", hours: 1, languages: ["zh"] }),
    ];
    expect(pickCourseForSkill("s1", pool, ["en"])?.id).toBe("free-long");
  });

  it("falls back across languages when nothing matches the study language", () => {
    const pool: Course[] = [course({ id: "zh-only-skill", skillIds: ["s2"], languages: ["zh"] })];
    expect(pickCourseForSkill("s2", pool, ["en"])?.id).toBe("zh-only-skill");
  });
});

describe("programme eligibility", () => {
  const programme: Programme = {
    id: "p1",
    name: "Example programme",
    agency: "Example agency",
    url: "https://example.com",
    benefits: "Example benefits",
    eligibility: {
      age_min: 18,
      age_max: 30,
      citizen: true,
      employment: ["any"],
      perkeso_contributor: true,
      states: ["all"],
    },
    costType: "free",
    deadline: null,
    lastChecked: "2026-10-01",
  };

  it("is 'check' when the PERKESO answer is unknown", () => {
    expect(programmeEligibilityStatus(programme, { age_band: "25-29" })).toBe("check");
  });

  it("is 'pass' when every rule the slots can answer is satisfied", () => {
    expect(programmeEligibilityStatus(programme, { age_band: "25-29", perkeso_contributor: true })).toBe("pass");
  });

  it("is 'fail' when the age band is outside the rule's range", () => {
    expect(programmeEligibilityStatus(programme, { age_band: "45-54", perkeso_contributor: true })).toBe("fail");
  });
});

describe("buildPathwayPlan", () => {
  const role = {
    occupationId: "role-1",
    gap: [
      { skillId: "s1", label: "Skill one", importance: 0.9 },
      { skillId: "s2", label: "Skill two", importance: 0.8 },
    ],
  } as import("@/types/contracts").RoleResult;

  const courses: Course[] = [
    course({ id: "c1", skillIds: ["s1"], costType: "free", hours: 4, languages: ["en"] }),
    course({ id: "c2", skillIds: ["s2"], costType: "paid", hours: 6, languages: ["en"] }),
  ];
  const programmes: Programme[] = [];

  it("orders steps free-first and lays them out at the given weekly pace", () => {
    const plan = buildPathwayPlan({
      role,
      courses,
      programmes,
      studyLanguages: ["en"],
      hoursPerWeek: 4,
      skillLinks: [],
    });
    expect(plan.steps.map((step) => step.itemId)).toEqual(["c1", "c2"]);
    expect(plan.steps[0]).toMatchObject({ weekStart: 1, weekEnd: 1 });
    expect(plan.steps[1].weekStart).toBe(2);
  });
});
