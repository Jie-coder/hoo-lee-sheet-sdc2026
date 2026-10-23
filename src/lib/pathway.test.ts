import { describe, expect, it } from "vitest";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";
import type { Course, Programme } from "@/types/contracts";
import { analyzeProfile } from "./analyze";
import { CATALOGUE } from "./catalogue";
import {
  AI_READINESS_PROGRAMME_ID,
  buildPathwayPlan,
  filterCoursesByLanguage,
  missingChineseCourse,
  normalizeUrl,
  pickCourseForSkill,
  programmeEligibilityStatus,
} from "./pathway";
import { resolveProfileSkills } from "./profile-skills";

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

describe("normalizeUrl", () => {
  it("treats scheme, www., trailing slash, and case as insignificant", () => {
    const base = normalizeUrl("https://rakyatdigital.gov.my/en/literacy-hub");
    expect(normalizeUrl("http://rakyatdigital.gov.my/en/literacy-hub")).toBe(base);
    expect(normalizeUrl("https://www.rakyatdigital.gov.my/en/literacy-hub")).toBe(base);
    expect(normalizeUrl("https://rakyatdigital.gov.my/en/literacy-hub/")).toBe(base);
    expect(normalizeUrl("https://RakyatDigital.gov.my/en/literacy-hub")).toBe(base);
  });

  it("treats a different path as a different resource", () => {
    expect(normalizeUrl("https://rakyatdigital.gov.my/en/literacy-hub")).not.toBe(
      normalizeUrl("https://rakyatdigital.gov.my/en/other-page"),
    );
  });
});

describe("buildPathwayPlan folds a course into a same-URL programme (p001/c006-style merge)", () => {
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

  const duplicateCourse = course({
    id: "c006",
    title: "AI untuk Rakyat",
    url: "https://www.rakyatdigital.gov.my/en/literacy-hub/",
    languages: ["en", "ms", "zh"],
    hours: 4,
    certificate: true,
    skillIds: ["ai-basics"],
  });

  const roleWithGap = {
    occupationId: "role-merge",
    gap: [{ skillId: "ai-basics", label: "principles of artificial intelligence", importance: 1 }],
  } as import("@/types/contracts").RoleResult;

  it("does not add the duplicate-URL course as its own step, and closes the gap via the programme instead", () => {
    const plan = buildPathwayPlan({
      role: roleWithGap,
      courses: [duplicateCourse],
      programmes: [aiProgramme],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    expect(plan.steps.map((step) => step.itemId)).toEqual(["p001"]);
    expect(plan.steps[0].kind).toBe("program");
    expect(plan.steps[0].closesSkillIds).toEqual(["ai-basics"]);
  });

  it("carries the merged course's hours, certificate, and languages onto the programme step", () => {
    const plan = buildPathwayPlan({
      role: roleWithGap,
      courses: [duplicateCourse],
      programmes: [aiProgramme],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    expect(plan.steps[0].merged).toEqual({ hours: 4, certificate: true, languages: ["en", "ms", "zh"] });
  });

  it("does not count the merged course toward maxCoursesPerRole, and never double-counts it when it also matches a second gap skill", () => {
    const twoSkillCourse = course({ ...duplicateCourse, skillIds: ["ai-basics", "computer-literacy"] });
    const role2 = {
      occupationId: "role-merge-2",
      gap: [
        { skillId: "ai-basics", label: "principles of artificial intelligence", importance: 1 },
        { skillId: "computer-literacy", label: "have computer literacy", importance: 1 },
      ],
    } as import("@/types/contracts").RoleResult;
    const plan = buildPathwayPlan({
      role: role2,
      courses: [twoSkillCourse],
      programmes: [aiProgramme],
      studyLanguages: ["en"],
      hoursPerWeek: 6,
      skillLinks: [],
    });
    expect(plan.steps.map((step) => step.itemId)).toEqual(["p001"]);
    expect(plan.steps[0].closesSkillIds.sort()).toEqual(["ai-basics", "computer-literacy"]);
    expect(plan.steps[0].merged).toEqual({ hours: 4, certificate: true, languages: ["en", "ms", "zh"] });
  });
});

describe("no two steps in one pathway share a URL (demo CVs)", () => {
  function itemUrl(step: { kind: string; itemId: string }): string {
    const item =
      step.kind === "course"
        ? CATALOGUE.courses.find((candidate) => candidate.id === step.itemId)
        : CATALOGUE.programmes.find((candidate) => candidate.id === step.itemId);
    if (!item) throw new Error(`Unknown step item: ${step.itemId}`);
    return item.url;
  }

  it.each(PERSONA_IDS)("%s: every recommended role's plan has no duplicate normalized URLs across steps", (id) => {
    const persona = PERSONAS[id];
    const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
    const { skills } = resolveProfileSkills(CATALOGUE, id, chips);
    const result = analyzeProfile(CATALOGUE, {
      skills,
      currentOccupationId: persona.currentOccupationId,
      impactInterest: "none",
    });

    for (const role of result.roles) {
      const plan = buildPathwayPlan({
        role,
        courses: CATALOGUE.courses,
        programmes: CATALOGUE.programmes,
        studyLanguages: persona.courseLanguages,
        hoursPerWeek: 6,
        skillLinks: [],
        skillGroups: CATALOGUE.skillGroups,
        groupLabels: CATALOGUE.groupLabels,
      });
      const normalizedUrls = plan.steps.map((step) => normalizeUrl(itemUrl(step)));
      expect(new Set(normalizedUrls).size).toBe(normalizedUrls.length);
    }
  });
});

describe("missingChineseCourse", () => {
  const en = course({ id: "en", languages: ["en"], skillIds: ["a"] });
  const zh = course({ id: "zh", languages: ["zh", "en"], skillIds: ["b"] });
  it("flags a skill with no Chinese course when Chinese is preferred", () => {
    expect(missingChineseCourse(["a"], [en, zh], ["zh"])).toBe(true);
    expect(missingChineseCourse(["a"], [en, zh], ["en", "zh"])).toBe(true);
  });
  it("does not flag when a Chinese course exists or Chinese is not preferred", () => {
    expect(missingChineseCourse(["b"], [en, zh], ["zh"])).toBe(false);
    expect(missingChineseCourse(["a"], [en, zh], ["en"])).toBe(false);
    expect(missingChineseCourse([], [en, zh], ["zh"])).toBe(false);
  });
  it("still falls back to the English course for that skill", () => {
    expect(pickCourseForSkill("a", [en, zh], ["zh"])?.id).toBe("en");
  });
});
