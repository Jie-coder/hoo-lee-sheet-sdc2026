import type { Course, SdgLink } from "@/types/contracts";

export type SdgTotalCourse = {
  id: string;
  title: string;
  reason: string;
};

export type SdgTargetTotal = {
  target: string;
  count: number;
  courses: SdgTotalCourse[];
  roleReason?: string;
};

export type SdgGoalTotal = {
  goal: number;
  count: number;
  targets: SdgTargetTotal[];
};

export type PathwaySdgTotal = {
  goals: SdgGoalTotal[];
};

/**
 * Totals the SDG contributions of a pathway: each chosen course counts once
 * toward its own target, and each of the role's SDG links adds one to its
 * target. Goals are ordered by contribution count, then goal number.
 */
export function pathwaySdgTotal(courses: Course[], roleSdg: SdgLink[]): PathwaySdgTotal {
  const byTarget = new Map<string, SdgTargetTotal>();
  const seenCourseIds = new Set<string>();

  for (const course of courses) {
    if (seenCourseIds.has(course.id)) continue;
    seenCourseIds.add(course.id);
    const target = byTarget.get(course.sdgTarget) ?? {
      target: course.sdgTarget,
      count: 0,
      courses: [],
    };
    target.count += 1;
    target.courses.push({ id: course.id, title: course.title, reason: course.sdgReason });
    byTarget.set(course.sdgTarget, target);
  }

  for (const link of roleSdg) {
    const target = byTarget.get(link.target) ?? {
      target: link.target,
      count: 0,
      courses: [],
    };
    target.count += 1;
    if (target.roleReason === undefined) target.roleReason = link.reason;
    byTarget.set(link.target, target);
  }

  const byGoal = new Map<number, SdgGoalTotal>();
  for (const target of byTarget.values()) {
    const goal = Number.parseInt(target.target.split(".")[0] ?? "", 10);
    if (!Number.isInteger(goal)) continue;
    const total = byGoal.get(goal) ?? { goal, count: 0, targets: [] };
    total.count += target.count;
    total.targets.push(target);
    byGoal.set(goal, total);
  }

  const goals = [...byGoal.values()];
  for (const goal of goals) {
    goal.targets.sort((a, b) => b.count - a.count || a.target.localeCompare(b.target));
  }
  goals.sort((a, b) => b.count - a.count || a.goal - b.goal);

  return { goals };
}
