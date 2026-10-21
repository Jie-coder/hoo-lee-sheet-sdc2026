// The landing page's "what you get" card: the real result for the sample
// persona Aisyah, computed on the server from the same pipeline as /results.
import { analyzeProfile } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
import { buildPathwayPlan } from "@/lib/pathway";
import { resolveProfileSkills } from "@/lib/profile-skills";
import { PERSONAS } from "@/mocks/personas";
import type { CostType, RoleResult, Source } from "@/types/contracts";

export type LandingPreview = {
  personaName: string;
  currentTitle: string;
  currentExposure: number;
  role: RoleResult;
  statusLabel: string;
  robust: boolean;
  targetLabels: Record<string, string>;
  planWeeks: number;
  planHoursPerWeek: number;
  mostlyFree: boolean;
  signalsAsOf: string;
  sources: Source[];
};

const PREVIEW_HOURS_PER_WEEK = 6;

export function landingPreview(): LandingPreview {
  const persona = PERSONAS.aisyah;
  const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
  const { skills } = resolveProfileSkills(CATALOGUE, persona.id, chips);
  const result = analyzeProfile(CATALOGUE, {
    skills,
    currentOccupationId: persona.currentOccupationId,
    impactInterest: "none",
  });
  // The top role in the Co-Pilot future (the default tab on /results).
  const role = [...result.roles].sort((a, b) => b.byScenario.co - a.byScenario.co)[0];
  const breakdown = result.breakdown[role.occupationId];
  const plan = buildPathwayPlan({
    role,
    courses: CATALOGUE.courses,
    programmes: CATALOGUE.programmes,
    studyLanguages: persona.courseLanguages,
    hoursPerWeek: PREVIEW_HOURS_PER_WEEK,
    skillLinks: [],
    skillGroups: CATALOGUE.skillGroups,
    groupLabels: CATALOGUE.groupLabels,
  });
  const costs: CostType[] = plan.steps.map((step) => {
    const item =
      step.kind === "course"
        ? CATALOGUE.courses.find((course) => course.id === step.itemId)
        : CATALOGUE.programmes.find((programme) => programme.id === step.itemId);
    return item?.costType ?? "paid";
  });

  return {
    personaName: persona.name,
    currentTitle: result.currentWork?.title ?? persona.jobTitle,
    currentExposure: result.currentWork?.exposure ?? 0,
    role,
    statusLabel: breakdown.status.label,
    robust: role.robust,
    targetLabels: result.targetLabels,
    planWeeks: plan.steps.reduce((max, step) => Math.max(max, step.weekEnd), 0),
    planHoursPerWeek: PREVIEW_HOURS_PER_WEEK,
    mostlyFree: costs.filter((cost) => cost === "free").length >= costs.length / 2,
    signalsAsOf: result.signalsAsOf,
    sources: role.sources,
  };
}
