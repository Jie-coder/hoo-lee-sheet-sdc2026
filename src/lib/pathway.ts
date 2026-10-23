// Pure logic for the Pathway step: filter the course catalogue by study
// language, check programme eligibility against interview slots, and turn
// a chosen role's skill gap into a week-by-week PathwayPlan.
import {
  AGE_BAND_RANGES,
  PathwayPlanSchema,
  type Course,
  type CostType,
  type CourseAiContent,
  type LanguageCode,
  type MergedCourseInfo,
  type PartialSlots,
  type PathwayPlan,
  type PlanStep,
  type Programme,
  type RoleResult,
  type SdgLink,
} from "@/types/contracts";

/**
 * Normalizes a URL for same-resource comparison: scheme and fragment are
 * dropped (they don't change what page loads), host is lower-cased with any
 * "www." stripped, and a trailing slash on the path is removed (except for
 * the bare root). Query strings are kept as-is since two different query
 * strings can legitimately point at different content.
 *
 * Used to detect when a catalogue course and a programme cite the same page
 * (see mergeDuplicateUrlCourse below) without hardcoding either id.
 */
export function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.trim().toLowerCase();
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  return `${host}${path}${parsed.search}`;
}

/** Only the courses offered in at least one of the learner's study languages. */
export function filterCoursesByLanguage(courses: readonly Course[], languages: readonly LanguageCode[]): Course[] {
  if (languages.length === 0) return [...courses];
  return courses.filter((course) => course.languages.some((language) => languages.includes(language)));
}

const COST_ORDER: Record<CostType, number> = { free: 0, subsidised: 1, hrdcorp_claimable: 2, paid: 3 };

/**
 * AI-content tie-break: ai, then digital, then none. rankCourses is only
 * ever called with courses that already equally fill one gap skill (either
 * all teach it exactly, or all teach a related skill in the same ESCO
 * group), so this is always a tie-break among equal gap-fill, never a
 * reason to prefer a course that closes a different (or no) gap. It sits
 * between cost and hours: cost stays the dominant sort key (unchanged from
 * before this field existed), and among same-cost options we'd rather
 * nudge the learner toward more AI/digital exposure than save a little
 * time, so it outranks the hours tie-break.
 */
const AI_CONTENT_ORDER: Record<CourseAiContent, number> = { ai: 0, digital: 1, none: 2 };

/**
 * Preference order for course choices: in the learner's study language first
 * (courses outside it are only considered when none are in it), then
 * cheapest, then the AI-content tie-break, then shortest.
 */
function rankCourses(matches: readonly Course[], languages: readonly LanguageCode[]): Course[] {
  const inLanguage = filterCoursesByLanguage(matches, languages);
  const pool = inLanguage.length > 0 ? inLanguage : matches;
  return [...pool].sort(
    (a, b) =>
      COST_ORDER[a.costType] - COST_ORDER[b.costType] ||
      AI_CONTENT_ORDER[a.aiContent] - AI_CONTENT_ORDER[b.aiContent] ||
      a.hours - b.hours,
  );
}

/** Cheapest, then shortest, course that closes `skillId` in the learner's language. */
export function pickCourseForSkill(
  skillId: string,
  courses: readonly Course[],
  languages: readonly LanguageCode[],
): Course | null {
  const matches = courses.filter((course) => course.skillIds.includes(skillId));
  return rankCourses(matches, languages)[0] ?? null;
}

/** Up to `limit` courses that close `skillId`, in the same preference order as {@link pickCourseForSkill}. */
export function pickCoursesForSkill(
  skillId: string,
  courses: readonly Course[],
  languages: readonly LanguageCode[],
  limit: number,
): Course[] {
  const matches = courses.filter((course) => course.skillIds.includes(skillId));
  return rankCourses(matches, languages).slice(0, limit);
}

/**
 * True when Chinese is among the learner's study languages but no course in the
 * catalogue closes any of `skillIds` in ANY of the selected languages, so the
 * step falls back to courses in another language and should say so.
 */
export function missingChineseCourse(
  skillIds: readonly string[],
  courses: readonly Course[],
  languages: readonly LanguageCode[],
): boolean {
  // With English picked a fallback never happens (catalogue is English-first);
  // the note is about Chinese, so it needs Chinese selected.
  if (!languages.includes("zh") || languages.includes("en") || skillIds.length === 0) return false;
  return !courses.some(
    (course) =>
      course.languages.some((language) => languages.includes(language)) &&
      course.skillIds.some((skillId) => skillIds.includes(skillId)),
  );
}

/**
 * Which language pill a course card shows: the first of the learner's study
 * languages the course is offered in, else the course's first listed language.
 */
export function courseLanguagePill(
  courseLanguages: readonly LanguageCode[],
  studyLanguages: readonly LanguageCode[],
): "ZH" | "BM" | "EN" {
  const code = studyLanguages.find((language) => courseLanguages.includes(language)) ?? courseLanguages[0] ?? "en";
  return code === "zh" ? "ZH" : code === "ms" ? "BM" : "EN";
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
  return rankCourses(matches, languages)[0] ?? null;
}

/** Up to `limit` same-ESCO-group courses for `skillId`, in the same preference order as {@link pickRelatedCourse}. */
export function pickRelatedCourses(
  skillId: string,
  courses: readonly Course[],
  languages: readonly LanguageCode[],
  skillGroups: Readonly<Record<string, string>>,
  limit: number,
): Course[] {
  const group = skillGroups[skillId];
  if (!group) return [];
  const matches = courses.filter((course) => course.skillIds.some((id) => skillGroups[id] === group));
  return rankCourses(matches, languages).slice(0, limit);
}

/**
 * Up to coursesPerGapSkill courses are suggested per gap skill (exact
 * matches, or related ones when nothing teaches the skill exactly), and a
 * plan never lists more than maxCoursesPerRole courses in total. Both are
 * demo tuning values, not derived from data.
 */
export const PATHWAY_PARAMS = {
  /** How many courses to suggest for each gap skill, at most. */
  coursesPerGapSkill: 3,
  /** A plan never lists more courses than this. The AI-readiness programme step at the start does not count toward it. */
  maxCoursesPerRole: 8,
} as const;

/**
 * Builds the PathwayPlan for one chosen role: the AI-readiness programme,
 * then up to PATHWAY_PARAMS.coursesPerGapSkill courses per gap skill
 * (cheapest and shortest in the learner's study language). When no course
 * teaches a gap skill exactly, up to that many courses from the same ESCO
 * skill group are suggested instead, without claiming to close the gap. The
 * plan stops adding courses once PATHWAY_PARAMS.maxCoursesPerRole is
 * reached (the AI-readiness programme does not count toward it). Ordered
 * free -> subsidised -> HRD Corp claimable -> paid and laid out at
 * `hoursPerWeek` a week. A course is never listed twice.
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

  type Pick = {
    kind: "course" | "program";
    item: Course | Programme;
    closesSkillIds: string[];
    hours: number;
    why: string;
    /** Courses folded into this (programme) pick because they cite the same URL. */
    mergedCourses?: Course[];
  };

  const picks: Pick[] = [];

  const aiProgramme = programmes.find((programme) => programme.id === AI_READINESS_PROGRAMME_ID);
  if (aiProgramme) {
    picks.push({ kind: "program", item: aiProgramme, closesSkillIds: [], hours: 1.5, why: aiProgramme.benefits });
  }

  // Only "course" picks count toward maxCoursesPerRole. A course folded into a
  // programme pick via mergeDuplicateUrlCourse below is never pushed as its
  // own "course" pick, so it never counts here either — same rule as the
  // AI-readiness programme step itself not counting.
  const courseCount = () => picks.filter((pick) => pick.kind === "course").length;

  /**
   * If `candidate` cites the same page as a programme already in the plan
   * (compared with normalizeUrl, so scheme/www/trailing-slash/case
   * differences don't matter), folds it into that programme pick instead of
   * adding a separate step: the gap skill is recorded as closed by the
   * programme, and the course's hours/certificate/languages are carried on
   * the pick for the UI. Returns true when it merged, so the caller skips
   * just this candidate. No replacement course is pulled in for the slot;
   * the skill's other suggested courses stay as alternatives.
   */
  function mergeDuplicateUrlCourse(candidate: Course, skillId: string, isRelated: boolean): boolean {
    const target = normalizeUrl(candidate.url);
    const programmePick = picks.find((pick) => pick.kind === "program" && normalizeUrl((pick.item as Programme).url) === target);
    if (!programmePick) return false;
    if (!isRelated && !programmePick.closesSkillIds.includes(skillId)) {
      programmePick.closesSkillIds.push(skillId);
    }
    if (!programmePick.mergedCourses?.some((course) => course.id === candidate.id)) {
      programmePick.mergedCourses = [...(programmePick.mergedCourses ?? []), candidate];
    }
    return true;
  }

  /**
   * Combines the courses folded into a programme pick (same URL, see
   * mergeDuplicateUrlCourse) into the single info block the UI shows on the
   * programme card: the longest stated duration, a certificate if any of
   * them offers one, and every language any of them is offered in.
   */
  function mergeCourseInfo(mergedCourses: readonly Course[]): MergedCourseInfo {
    return {
      hours: Math.max(...mergedCourses.map((course) => course.hours)),
      certificate: mergedCourses.some((course) => course.certificate),
      languages: [...new Set(mergedCourses.flatMap((course) => course.languages))],
    };
  }

  for (const skill of role.gap) {
    if (courseCount() >= PATHWAY_PARAMS.maxCoursesPerRole) break;

    const exactCandidates = pickCoursesForSkill(skill.skillId, courses, studyLanguages, PATHWAY_PARAMS.coursesPerGapSkill);
    const isRelated = exactCandidates.length === 0;
    const candidates = isRelated
      ? pickRelatedCourses(skill.skillId, courses, studyLanguages, skillGroups, PATHWAY_PARAMS.coursesPerGapSkill)
      : exactCandidates;

    for (const candidate of candidates) {
      const existing = picks.find((pick) => pick.item.id === candidate.id);
      if (existing) {
        if (!isRelated && !existing.closesSkillIds.includes(skill.skillId)) {
          existing.closesSkillIds.push(skill.skillId);
          existing.why = `${existing.why.replace(/\.$/, "")}, ${skill.label}.`;
        }
        continue;
      }
      if (mergeDuplicateUrlCourse(candidate, skill.skillId, isRelated)) continue;
      if (courseCount() >= PATHWAY_PARAMS.maxCoursesPerRole) break;
      if (isRelated) {
        const groupLabel = groupLabels[skillGroups[skill.skillId] ?? ""] ?? "the same ESCO skill group";
        picks.push({
          kind: "course",
          item: candidate,
          closesSkillIds: [],
          hours: candidate.hours,
          why: `No course in our catalogue teaches "${skill.label}" yet. This one builds related skills (ESCO group: ${groupLabel}).`,
        });
      } else {
        picks.push({
          kind: "course",
          item: candidate,
          closesSkillIds: [skill.skillId],
          hours: candidate.hours,
          why: `Closes the gap skill: ${skill.label}.`,
        });
      }
    }
  }

  const ordered = [...picks].sort((a, b) => COST_ORDER[a.item.costType] - COST_ORDER[b.item.costType]);

  let cursor = 1;
  const steps: PlanStep[] = ordered.map((pick) => {
    const weeks = Math.max(1, Math.ceil(pick.hours / pace));
    const weekStart = cursor;
    const weekEnd = weekStart + weeks - 1;
    cursor = weekEnd + 1;
    const merged = pick.mergedCourses?.length ? mergeCourseInfo(pick.mergedCourses) : undefined;
    return {
      itemId: pick.item.id,
      kind: pick.kind,
      weekStart,
      weekEnd,
      closesSkillIds: pick.closesSkillIds,
      sdgTarget: sdgTargetForSkills(pick.closesSkillIds, skillLinks),
      why: pick.why,
      ...(merged ? { merged } : {}),
    };
  });

  return PathwayPlanSchema.parse({ occupationId: role.occupationId, steps });
}
