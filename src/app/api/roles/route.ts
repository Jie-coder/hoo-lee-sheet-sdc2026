// POST /api/roles: ranks future roles for a profile from the curated data
// (src/data/catalogue.json, built from data/*.csv). No LLM and no API key:
// the same profile always gets the same result. See src/lib/analyze.ts.
import { z } from "zod";
import { clampAdoptionSpeed } from "@/lib/adoption";
import { analyzeProfile, SIGNAL_DATES } from "@/lib/analyze";
import { catalogueFor, getActiveSignals, type ActiveSignals } from "@/lib/signals";
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
  adoptionSpeed: z.number().min(0.5).max(2).default(1),
  /** Upload only: the CV's most recent job title, so that job is not recommended back. */
  currentJobTitle: z.string().trim().max(200).optional(),
  /**
   * Test override ("change the data" panel): set skills' momentum in the
   * active snapshot for this request only. Never stored, so other users never see it.
   */
  overrides: z
    .array(z.strictObject({ skillId: z.string().min(1).max(300), momentum: z.number().min(-10).max(10) }))
    .max(50)
    .optional(),
});

export type RolesRequest = z.input<typeof RequestSchema>;
export type RolesResponse = ReturnType<typeof analyzeProfile> & {
  skillMatches: ReturnType<typeof resolveProfileSkills>["matches"];
  /** The trend snapshot this ranking used: source, fetch time, live or bundled, and whether a test override was applied. */
  trend: Pick<ActiveSignals, "source" | "fetchedAt" | "store" | "warning"> & { asOf: string; overridden: boolean };
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

  const { personaId, skills: chips, impactInterest, signalDate, adoptionSpeed, currentJobTitle, overrides = [] } = parsed.data;
  const active = await getActiveSignals();
  const catalogue = catalogueFor(active, overrides);
  const { skills, matches } = resolveProfileSkills(catalogue, personaId, chips);
  const currentOccupationId =
    personaId === "upload"
      ? detectCurrentOccupationId(currentJobTitle, catalogue.occupations)
      : PERSONAS[personaId].currentOccupationId;
  const result = analyzeProfile(catalogue, {
    skills,
    currentOccupationId,
    impactInterest,
    signalDate,
    adoption: clampAdoptionSpeed(adoptionSpeed),
  });

  const response: RolesResponse = {
    ...result,
    skillMatches: matches,
    trend: {
      source: active.source,
      store: active.store,
      warning: active.warning,
      fetchedAt: active.fetchedAt,
      asOf: active.snapshot.asOf,
      overridden: overrides.length > 0,
    },
  };
  return Response.json(response);
}
