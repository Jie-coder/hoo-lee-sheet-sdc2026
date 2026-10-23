// POST /api/roles: ranks future roles for a profile from the curated data
// (src/data/catalogue.json, built from data/*.csv). No LLM and no API key:
// the same profile always gets the same result. See src/lib/analyze.ts.
import { z } from "zod";
import { analyzeProfile, SIGNAL_DATES } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
import { resolveProfileSkills } from "@/lib/profile-skills";
import { detectCurrentOccupationId } from "@/lib/role-aliases";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";
import { ImpactInterestSchema } from "@/types/contracts";

const RequestSchema = z.strictObject({
  personaId: z.enum([...PERSONA_IDS, "upload"]),
  skills: z
    .array(z.strictObject({ label: z.string().trim().min(1).max(200), selfReported: z.boolean() }))
    .max(100),
  impactInterest: ImpactInterestSchema.default("none"),
  /** Rank with today's arXiv snapshot, or the one ~30 days earlier. */
  signalDate: z.enum(SIGNAL_DATES).default("today"),
  /** Upload only: the CV's most recent job title, so that job is not recommended back. */
  currentJobTitle: z.string().trim().max(200).optional(),
});

export type RolesRequest = z.input<typeof RequestSchema>;
export type RolesResponse = ReturnType<typeof analyzeProfile> & {
  skillMatches: ReturnType<typeof resolveProfileSkills>["matches"];
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown validation error"}` },
      { status: 400 },
    );
  }

  const { personaId, skills: chips, impactInterest, signalDate, currentJobTitle } = parsed.data;
  const { skills, matches } = resolveProfileSkills(CATALOGUE, personaId, chips);
  const currentOccupationId =
    personaId === "upload"
      ? detectCurrentOccupationId(currentJobTitle, CATALOGUE.occupations)
      : PERSONAS[personaId].currentOccupationId;
  const result = analyzeProfile(CATALOGUE, { skills, currentOccupationId, impactInterest, signalDate });

  const response: RolesResponse = { ...result, skillMatches: matches };
  return Response.json(response);
}
