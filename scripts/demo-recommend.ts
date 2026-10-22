// One-off diagnostic: for each of the 3 demo personas (Aisyah, Lim Jia Hui,
// Pravin), run the same analyzeProfile -> buildPathwayPlan pipeline the app
// uses on /results and /pathway (see src/lib/landing-preview.ts for the
// same pattern), and dump every recommended role's course list to JSON.
//
// Usage: npx tsx scripts/demo-recommend.ts > /tmp/demo_before.json
import { analyzeProfile } from "../src/lib/analyze";
import { CATALOGUE } from "../src/lib/catalogue";
import { buildPathwayPlan } from "../src/lib/pathway";
import { resolveProfileSkills } from "../src/lib/profile-skills";
import { PERSONAS, PERSONA_IDS } from "../src/mocks/personas";

const HOURS_PER_WEEK = 6;

type CourseOut = { id: string; title: string; ai_content?: string };

function main() {
  const output: Record<
    string,
    {
      name: string;
      roles: {
        occupationId: string;
        title: string;
        courses: CourseOut[];
      }[];
    }
  > = {};

  for (const personaId of PERSONA_IDS) {
    const persona = PERSONAS[personaId];
    const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
    const { skills } = resolveProfileSkills(CATALOGUE, persona.id, chips);
    const result = analyzeProfile(CATALOGUE, {
      skills,
      currentOccupationId: persona.currentOccupationId,
      impactInterest: "none",
    });

    const roles = result.roles.map((role) => {
      const plan = buildPathwayPlan({
        role,
        courses: CATALOGUE.courses,
        programmes: CATALOGUE.programmes,
        studyLanguages: persona.courseLanguages,
        hoursPerWeek: HOURS_PER_WEEK,
        skillLinks: [],
        skillGroups: CATALOGUE.skillGroups,
        groupLabels: CATALOGUE.groupLabels,
      });
      const courses: CourseOut[] = plan.steps
        .filter((step) => step.kind === "course")
        .map((step) => {
          const course = CATALOGUE.courses.find((c) => c.id === step.itemId);
          const out: CourseOut = { id: step.itemId, title: course?.title ?? "(unknown)" };
          if (course?.aiContent) out.ai_content = course.aiContent;
          return out;
        });
      return { occupationId: role.occupationId, title: role.title, courses };
    });

    output[personaId] = { name: persona.name, roles };
  }

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

main();
