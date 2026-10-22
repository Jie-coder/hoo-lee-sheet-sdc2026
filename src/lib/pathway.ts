// Pure logic for the Pathway step: filter the course catalogue by study
// language, check programme eligibility against interview slots, and turn
// a chosen role's skill gap into a week-by-week PathwayPlan.
import {
  AGE_BAND_RANGES,
  PathwayPlanSchema,
  type Course,
  type CostType,
  type LanguageCode,
  type PartialSlots,
  type PathwayPlan,
  type PlanStep,
  type Programme,
  type RoleResult,
  type SdgLink,
} from "@/types/contracts";

/** Only the courses offered in at least one of the learner's study languages. */
export function filterCoursesByLanguage(courses: readonly Course[], languages: readonly LanguageCode[]): Course[] {
  if (languages.length === 0) return [...courses];
  return courses.filter((course) => course.languages.some((language) => languages.includes(language)));
}

const COST_ORDER: Record<CostType, number> = { free: 0, subsidised: 1, hrdcorp_claimable: 2, paid: 3 };

/** Cheapest, then shortest, course that closes `skillId` in the learner's language. */
export function pickCourseForSkill(
  skillId: string,
  courses: readonly Course[],
  languages: readonly LanguageCode[],
): Course | null {
  const matches = courses.filter((course) => course.skillIds.includes(skillId));
  const inLanguage = filterCoursesByLanguage(matches, languages);
  const pool = inLanguage.length > 0 ? inLanguage : matches;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => COST_ORDER[a.costType] - COST_ORDER[b.costType] || a.hours - b.hours)[0];
}

export type EligibilityStatus = "pass" | "check" | "fail";

/**
 * Rules-based eligibility against the interview slots. Missing slots the
 * rule depends on return "check", never a guess. `citizen` has no matching
 * slot in the contract; every demo persona is a Malaysian citizen, so a
 * `citizen: true` rule is treated as satisfied rather than unknown.
 */
export function programmeEligibilityStatus(programme: Programme, slots: PartialSlots): EligibilityStatus {
  const rules = programme.eligibility;
  const checks: EligibilityStatus[] = [];

  if (rules.age_min != null || rules.age_max != null) {
    if (!slots.age_band) checks.push("check");
    else {
      const band = AGE_BAND_RANGES[slots.age_band];
      const bandMax = band.max ?? band.min;
      const withinMin = rules.age_min == null || bandMax >= rules.age_min;
      const withinMax = rules.age_max == null || band.min <= rules.age_max;
      checks.push(withinMin && withinMax ? "pass" : "fail");
    }
  }

  if (!rules.employment.includes("any")) {
    if (!slots.employment_status) checks.push("check");
    else checks.push(rules.employment.includes(slots.employment_status) ? "pass" : "fail");
  }

  if (rules.perkeso_contributor != null) {
    if (slots.perkeso_contributor == null) checks.push("check");
    else checks.push(slots.perkeso_contributor === rules.perkeso_contributor ? "pass" : "fail");
  }

  if (!rules.states.includes("all")) {
    if (!slots.state) checks.push("check");
    else checks.push(rules.states.includes(slots.state) ? "pass" : "fail");
  }

  if (checks.some((status) => status === "fail")) return "fail";
  if (checks.some((status) => status === "check")) return "check";
  return "pass";
}

function sdgTargetForSkills(skillIds: readonly string[], skillLinks: readonly SdgLink[]): string | undefined {
  for (const skillId of skillIds) {
    const link = skillLinks.find((item) => item.subject.kind === "skill" && item.subject.skillId === skillId);
    if (link) return link.target;
  }
  return undefined;
}

/** programmes.csv id of AI untuk Rakyat, the free AI-basics opener every plan starts with. */
export const AI_READINESS_PROGRAMME_ID = "p001";

/**
 * Cheapest, then shortest, course that teaches a skill in the same ESCO
 * skill group as `skillId`. Used only when no course teaches the skill
 * itself; such a step builds related skills and does not close the gap.
 */
export function pickRelatedCourse(
  skillId: string,
  courses: readonly Course[],
  languages: readonly LanguageCode[],
  skillGroups: Readonly<Record<string, string>>,
): Course | null {
  const group = skillGroups[skillId];
  if (!group) return null;
  const matches = courses.filter((course) => course.skillIds.some((id) => skillGroups[id] === group));
  const inLanguage = filterCoursesByLanguage(matches, languages);
  const pool = inLanguage.length > 0 ? inLanguage : matches;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => COST_ORDER[a.costType] - COST_ORDER[b.costType] || a.hours - b.hours)[0];
}

/**
 * Builds the PathwayPlan for one chosen role: the AI-readiness programme,
 * then one course per gap skill (cheapest and shortest in the learner's
 * study language). When no course teaches a gap skill, a course from the
 * same ESCO skill group is suggested instead, without claiming to close
 * the gap. Ordered free -> subsidised -> HRD Corp claimable -> paid and
 * laid out at `hoursPerWeek` a week. A course is never listed twice.
 */
export function buildPathwayPlan({
  role,
  courses,
  programmes,
  studyLanguages,
  hoursPerWeek,
  skillLinks,
  skillGroups = {},
  groupLabels = {},
}: {
  role: RoleResult;
  courses: readonly Course[];
  programmes: readonly Programme[];
  studyLanguages: readonly LanguageCode[];
  hoursPerWeek: number;
  skillLinks: readonly SdgLink[];
  skillGroups?: Readonly<Record<string, string>>;
  groupLabels?: Readonly<Record<string, string>>;
}): PathwayPlan {
  const pace = hoursPerWeek > 0 ? hoursPerWeek : 6;

  type Pick = { kind: "course" | "program"; item: Course | Programme; closesSkillIds: string[]; hours: number; why: string };

  const picks: Pick[] = [];

  const aiProgramme = programmes.find((programme) => programme.id === AI_READINESS_PROGRAMME_ID);
  if (aiProgramme) {
    picks.push({ kind: "program", item: aiProgramme, closesSkillIds: [], hours: 1.5, why: aiProgramme.benefits });
  }

  for (const skill of role.gap) {
    const exact = pickCourseForSkill(skill.skillId, courses, studyLanguages);
    const existing = exact ? picks.find((pick) => pick.item.id === exact.id) : undefined;
    if (existing) {
      existing.closesSkillIds.push(skill.skillId);
      existing.why = `${existing.why.replace(/\.$/, "")}, ${skill.label}.`;
      continue;
    }
    if (exact) {
      picks.push({
        kind: "course",
        item: exact,
        closesSkillIds: [skill.skillId],
        hours: exact.hours,
        why: `Closes the gap skill: ${skill.label}.`,
      });
      continue;
    }
    const related = pickRelatedCourse(skill.skillId, courses, studyLanguages, skillGroups);
    if (!related || picks.some((pick) => pick.item.id === related.id)) continue;
    const groupLabel = groupLabels[skillGroups[skill.skillId] ?? ""] ?? "the same ESCO skill group";
    picks.push({
      kind: "course",
      item: related,
      closesSkillIds: [],
      hours: related.hours,
      why: `No course in our catalogue teaches "${skill.label}" yet. This one builds related skills (ESCO group: ${groupLabel}).`,
    });
  }

  const ordered = [...picks].sort((a, b) => COST_ORDER[a.item.costType] - COST_ORDER[b.item.costType]);

  let cursor = 1;
  const steps: PlanStep[] = ordered.map((pick) => {
    const weeks = Math.max(1, Math.ceil(pick.hours / pace));
    const weekStart = cursor;
    const weekEnd = weekStart + weeks - 1;
    cursor = weekEnd + 1;
    return {
      itemId: pick.item.id,
      kind: pick.kind,
      weekStart,
      weekEnd,
      closesSkillIds: pick.closesSkillIds,
      sdgTarget: sdgTargetForSkills(pick.closesSkillIds, skillLinks),
      why: pick.why,
    };
  });

  return PathwayPlanSchema.parse({ occupationId: role.occupationId, steps });
}
