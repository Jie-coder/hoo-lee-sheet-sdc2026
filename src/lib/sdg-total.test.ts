import { describe, expect, it } from "vitest";
import type { Course, SdgLink } from "@/types/contracts";
import { SdgTargetIdSchema } from "@/types/contracts";
import { CATALOGUE } from "./catalogue";
import { pathwaySdgTotal } from "./sdg-total";

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
    sdgTarget: "4.4",
    sdgReason: "Builds a transferable digital skill.",
    lastChecked: "2026-10-01",
    mode: "online",
    aiContent: "none",
    ...overrides,
  };
}

function roleLink(target: string, reason: string): SdgLink {
  return {
    subject: { kind: "occupation", occupationId: "role-1" },
    target,
    kind: "role",
    tier: "direct",
    confidence: 1,
    reason,
    source: {
      dataset: "UN SDG targets",
      releaseDate: "2026-01-01",
      url: "https://example.com/sdg",
      asOf: "2026-01-01",
    },
  };
}

describe("pathwaySdgTotal", () => {
  it("returns no goals for empty input", () => {
    expect(pathwaySdgTotal([], [])).toEqual({ goals: [] });
  });

  it("counts each course once even when it is passed more than once", () => {
    const dataCourse = course({ id: "c1", title: "Data course", sdgTarget: "4.4" });
    const result = pathwaySdgTotal([dataCourse, dataCourse], []);

    expect(result.goals).toHaveLength(1);
    expect(result.goals[0]).toMatchObject({ goal: 4, count: 1 });
    expect(result.goals[0].targets[0]).toMatchObject({
      target: "4.4",
      count: 1,
      courses: [{ id: "c1", title: "Data course" }],
    });
    expect(result.goals[0].targets[0].courses).toHaveLength(1);
  });

  it("sorts goals by count descending, then by goal number ascending", () => {
    const result = pathwaySdgTotal(
      [
        course({ id: "c1", sdgTarget: "8.6" }),
        course({ id: "c2", sdgTarget: "4.4" }),
        course({ id: "c3", sdgTarget: "4.3" }),
        course({ id: "c4", sdgTarget: "1.2" }),
      ],
      [],
    );

    expect(result.goals.map((goal) => goal.goal)).toEqual([4, 1, 8]);
    expect(result.goals.map((goal) => goal.count)).toEqual([2, 1, 1]);
  });

  it("adds the role link to the same target as a course and keeps the role reason", () => {
    const result = pathwaySdgTotal(
      [course({ id: "c1", title: "Data course", sdgTarget: "4.4" })],
      [roleLink("4.4", "This work trains people in data skills."), roleLink("8.6", "The role supports decent work.")],
    );

    expect(result.goals.map((goal) => goal.goal)).toEqual([4, 8]);
    const goal4 = result.goals[0];
    expect(goal4.count).toBe(2);
    expect(goal4.targets).toHaveLength(1);
    expect(goal4.targets[0]).toMatchObject({
      target: "4.4",
      count: 2,
      roleReason: "This work trains people in data skills.",
      courses: [{ id: "c1", title: "Data course" }],
    });
    expect(result.goals[1].targets[0]).toMatchObject({
      target: "8.6",
      count: 1,
      courses: [],
      roleReason: "The role supports decent work.",
    });
  });

  it("keeps sdgTarget and sdgReason on every catalogue course", () => {
    expect(CATALOGUE.courses.length).toBeGreaterThan(0);
    for (const catalogueCourse of CATALOGUE.courses) {
      expect(SdgTargetIdSchema.safeParse(catalogueCourse.sdgTarget).success, catalogueCourse.id).toBe(true);
      expect(catalogueCourse.sdgReason.trim().length, catalogueCourse.id).toBeGreaterThan(0);
    }
  });
});
