import { describe, expect, it } from "vitest";
import type { Course, Programme } from "@/types/contracts";
import {
  AI_READINESS_PROGRAMME_ID,
  buildPathwayPlan,
  filterCoursesByLanguage,
  pickCourseForSkill,
  programmeEligibilityStatus,
} from "./pathway";

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
    aiContent: "none",
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

  it("among equal cost and gap-fill, tie-breaks ai > digital > none", () => {
    const pool: Course[] = [
      course({ id: "none-tier", skillIds: ["s1"], costType: "free", hours: 5, aiContent: "none" }),
      course({ id: "digital-tier", skillIds: ["s1"], costType: "free", hours: 5, aiContent: "digital" }),
      course({ id: "ai-tier", skillIds: ["s1"], costType: "free", hours: 5, aiContent: "ai" }),
    ];
    expect(pickCourseForSkill("s1", pool, ["en"])?.id).toBe("ai-tier");
  });

  it("the AI-content tie-break never beats cost: a cheaper none-tier course still wins over a pricier ai-tier one", () => {
    const pool: Course[] = [
      course({ id: "paid-ai", skillIds: ["s1"], costType: "paid", hours: 5, aiContent: "ai" }),
      course({ id: "free-none", skillIds: ["s1"], costType: "free", hours: 5, aiContent: "none" }),
    ];
    expect(pickCourseForSkill("s1", pool, ["en"])?.id).toBe("free-none");
  });

  it("the AI-content tie-break outranks hours: a longer ai-tier course beats a shorter digital-tier one at the same cost", () => {
    const pool: Course[] = [
      course({ id: "short-digital", skillIds: ["s1"], costType: "free", hours: 1, aiContent: "digital" }),
      course({ id: "long-ai", skillIds: ["s1"], costType: "free", hours: 10, aiContent: "ai" }),
    ];
    expect(pickCourseForSkill("s1", pool, ["en"])?.id).toBe("long-ai");
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

describe("buildPathwayPlan with real-data rules", () => {
  const role = {
    occupationId: "role-2",
    gap: [
      { skillId: "s1", label: "Skill one", importance: 1 },
      { skillId: "s2", label: "Skill two", importance: 1 },
      { skillId: "s3", label: "Skill three", importance: 1 },
    ],
  } as import("@/types/contracts").RoleResult;

  it("lists a course that closes two gap skills once, closing both", () => {
    const plan = buildPathwayPlan({
      role,
      courses: [course({ id: "both", skillIds: ["s1", "s2"] })],
      programmes: [],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    expect(plan.steps.map((step) => step.itemId)).toEqual(["both"]);
    expect(plan.steps[0].closesSkillIds).toEqual(["s1", "s2"]);
  });

  it("suggests a same-ESCO-group course when none teaches the skill, without claiming it closes the gap", () => {
    const plan = buildPathwayPlan({
      role,
      courses: [course({ id: "related", skillIds: ["other"] })],
      programmes: [],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
      skillGroups: { s3: "g1", other: "g1" },
      groupLabels: { g1: "managing data" },
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ itemId: "related", closesSkillIds: [] });
    expect(plan.steps[0].why).toContain("managing data");
    expect(plan.steps[0].why).toContain("Skill three");
  });

  it("suggests at most 3 courses per gap skill, cheapest and shortest first", () => {
    const oneSkillRole = {
      occupationId: "role-caps",
      gap: [{ skillId: "s1", label: "Skill one", importance: 1 }],
    } as import("@/types/contracts").RoleResult;
    const fourCourses: Course[] = [
      course({ id: "c1", skillIds: ["s1"], costType: "free", hours: 10, languages: ["en"] }),
      course({ id: "c2", skillIds: ["s1"], costType: "free", hours: 2, languages: ["en"] }),
      course({ id: "c3", skillIds: ["s1"], costType: "subsidised", hours: 1, languages: ["en"] }),
      course({ id: "c4", skillIds: ["s1"], costType: "paid", hours: 1, languages: ["en"] }),
    ];
    const plan = buildPathwayPlan({
      role: oneSkillRole,
      courses: fourCourses,
      programmes: [],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    // c2 (free, 2h) beats c1 (free, 10h) on hours; c3 is subsidised; c4 (paid) is excluded by the cap of 3.
    expect(plan.steps.map((step) => step.itemId)).toEqual(["c2", "c1", "c3"]);
  });

  it("never lists the same course twice, even when it is top-3 for more than one gap skill", () => {
    const role2: import("@/types/contracts").RoleResult = {
      occupationId: "role-dedup",
      gap: [
        { skillId: "s1", label: "Skill one", importance: 1 },
        { skillId: "s2", label: "Skill two", importance: 1 },
      ],
    } as import("@/types/contracts").RoleResult;
    const courses: Course[] = [
      course({ id: "shared1", skillIds: ["s1", "s2"], costType: "free", hours: 2, languages: ["en"] }),
      course({ id: "shared2", skillIds: ["s1", "s2"], costType: "free", hours: 3, languages: ["en"] }),
      course({ id: "only-s2", skillIds: ["s2"], costType: "free", hours: 5, languages: ["en"] }),
    ];
    const plan = buildPathwayPlan({
      role: role2,
      courses,
      programmes: [],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    const ids = plan.steps.map((step) => step.itemId);
    expect(ids).toEqual(["shared1", "shared2", "only-s2"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.steps.find((step) => step.itemId === "shared1")?.closesSkillIds).toEqual(["s1", "s2"]);
    expect(plan.steps.find((step) => step.itemId === "shared2")?.closesSkillIds).toEqual(["s1", "s2"]);
    expect(plan.steps.find((step) => step.itemId === "only-s2")?.closesSkillIds).toEqual(["s2"]);
  });

  it("falls back to up to 3 same-ESCO-group courses when nothing teaches the skill exactly", () => {
    const role3 = {
      occupationId: "role-related",
      gap: [{ skillId: "s1", label: "Skill one", importance: 1 }],
    } as import("@/types/contracts").RoleResult;
    const courses: Course[] = [
      course({ id: "r1", skillIds: ["other"], costType: "free", hours: 5, languages: ["en"] }),
      course({ id: "r2", skillIds: ["other"], costType: "free", hours: 1, languages: ["en"] }),
      course({ id: "r3", skillIds: ["other"], costType: "subsidised", hours: 1, languages: ["en"] }),
      course({ id: "r4", skillIds: ["other"], costType: "paid", hours: 1, languages: ["en"] }),
    ];
    const plan = buildPathwayPlan({
      role: role3,
      courses,
      programmes: [],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
      skillGroups: { s1: "g1", other: "g1" },
      groupLabels: { g1: "managing data" },
    });
    expect(plan.steps.map((step) => step.itemId)).toEqual(["r2", "r1", "r3"]);
    expect(plan.steps.every((step) => step.closesSkillIds.length === 0)).toBe(true);
  });

  it("stops adding once 8 courses are in the plan; the AI-readiness programme does not count toward the cap", () => {
    const gap = Array.from({ length: 4 }, (_, i) => ({ skillId: `s${i}`, label: `Skill ${i}`, importance: 1 }));
    const role4 = { occupationId: "role-cap8", gap } as import("@/types/contracts").RoleResult;
    const manyCourses: Course[] = gap.flatMap((skill) =>
      Array.from({ length: 3 }, (_, j) =>
        course({ id: `${skill.skillId}-${j}`, skillIds: [skill.skillId], costType: "free", hours: 1, languages: ["en"] }),
      ),
    );
    const aiProgramme: Programme = {
      id: AI_READINESS_PROGRAMME_ID,
      name: "AI untuk Rakyat Programme",
      agency: "Ministry of Digital",
      url: "https://rakyatdigital.gov.my/en/literacy-hub",
      benefits: "Free AI basics.",
      eligibility: { age_min: null, age_max: null, citizen: true, employment: ["any"], perkeso_contributor: null, states: ["all"] },
      costType: "free",
      deadline: null,
      lastChecked: "2026-10-20",
    };
    const plan = buildPathwayPlan({
      role: role4,
      courses: manyCourses,
      programmes: [aiProgramme],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    const courseSteps = plan.steps.filter((step) => step.kind === "course");
    expect(courseSteps).toHaveLength(8);
    expect(plan.steps.some((step) => step.kind === "program")).toBe(true);
    expect(courseSteps.map((step) => step.itemId).sort()).toEqual(
      ["s0-0", "s0-1", "s0-2", "s1-0", "s1-1", "s1-2", "s2-0", "s2-1"].sort(),
    );
  });

  it("opens on the AI untuk Rakyat programme (p001) when it is in the catalogue", () => {
    const aiProgramme = {
      id: AI_READINESS_PROGRAMME_ID,
      name: "AI untuk Rakyat Programme",
      agency: "Ministry of Digital",
      url: "https://rakyatdigital.gov.my/en/literacy-hub",
      benefits: "Free AI basics.",
      eligibility: { age_min: null, age_max: null, citizen: true, employment: ["any"], perkeso_contributor: null, states: ["all"] },
      costType: "free",
      deadline: null,
      lastChecked: "2026-10-20",
    } satisfies Programme;
    const plan = buildPathwayPlan({
      role,
      courses: [],
      programmes: [aiProgramme],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    expect(plan.steps.map((step) => step.itemId)).toEqual(["p001"]);
  });
});
