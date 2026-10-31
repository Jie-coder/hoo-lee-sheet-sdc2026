// Sponsored placement ("Be Our Partner" demo). Pure and deliberately separate
// from scoring, ranking and buildPathwayPlan: it only READS a finished plan
// and decides which stops may show one clearly labelled sponsored card.
// Paid placement buys visibility, never ranking.
import data from "@/data/sponsored-courses.json";

export const MAX_SPONSORED_PER_STOP = 1;
export const MAX_SPONSORED_PER_PATHWAY = 3;

export type SponsoredCourse = {
  id: string;
  title: string;
  provider: string;
  skillId: string;
  skillLabel: string;
  examplePrice: string;
  url: string;
};

export const SPONSORED_COURSES: readonly SponsoredCourse[] = data.courses;

export type SponsoredStop = { itemId: string; closesSkillIds: readonly string[] };

export type SponsoredPick = {
  /** Index of the plan stop the card is shown inside (as its last card). */
  stopIndex: number;
  skillId: string;
  course: SponsoredCourse;
};

/**
 * Picks at most MAX_SPONSORED_PER_PATHWAY sponsored courses, at most
 * MAX_SPONSORED_PER_STOP per stop, each only where a stop closes a gap skill
 * the course teaches. Each sponsored course is used once. Non-adjacent stops
 * are filled first, then adjacent ones if slots remain.
 */
export function pickSponsored(
  steps: readonly SponsoredStop[],
  gapSkillIds: readonly string[],
  catalogue: readonly SponsoredCourse[] = SPONSORED_COURSES,
): SponsoredPick[] {
  const gap = new Set(gapSkillIds);
  const used = new Set<string>();
  const picks: SponsoredPick[] = [];

  function matchFor(index: number): SponsoredPick | null {
    for (const skillId of steps[index].closesSkillIds) {
      if (!gap.has(skillId)) continue;
      const course = catalogue.find((c) => c.skillId === skillId && !used.has(c.id));
      if (course) return { stopIndex: index, skillId, course };
    }
    return null;
  }

  for (const allowAdjacent of [false, true]) {
    for (let index = 0; index < steps.length; index += 1) {
      if (picks.length >= MAX_SPONSORED_PER_PATHWAY) break;
      if (picks.some((pick) => pick.stopIndex === index)) continue;
      if (!allowAdjacent && picks.some((pick) => Math.abs(pick.stopIndex - index) === 1)) continue;
      const pick = matchFor(index);
      if (!pick) continue;
      used.add(pick.course.id);
      picks.push(pick);
    }
  }
  return picks.sort((a, b) => a.stopIndex - b.stopIndex);
}
