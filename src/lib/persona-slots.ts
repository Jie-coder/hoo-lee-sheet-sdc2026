// Age band and state are on every persona's CV/location, so the interview
// never asks for them (section 03). This maps the three personas to the
// Slots values those CV facts imply.
import { AGE_BAND_RANGES, type AgeBand, type MalaysiaState } from "@/types/contracts";
import type { PersonaId } from "@/mocks/personas";

const PERSONA_AGE: Record<PersonaId, number> = { aisyah: 23, "lim-jia-hui": 30, pravin: 23 };
const PERSONA_STATE: Record<PersonaId, MalaysiaState> = {
  aisyah: "pulau_pinang",
  "lim-jia-hui": "johor",
  pravin: "selangor",
};

function ageBandForAge(age: number): AgeBand | null {
  const entry = Object.entries(AGE_BAND_RANGES).find(
    ([, range]) => age >= range.min && (range.max == null || age <= range.max),
  );
  return (entry?.[0] as AgeBand | undefined) ?? null;
}

/** `null` for the "upload" profile: there is no persona CV to read these from. */
export function personaKnownSlots(personaId: PersonaId | "upload"): { ageBand: AgeBand | null; state: MalaysiaState | null } {
  if (personaId === "upload") return { ageBand: null, state: null };
  return { ageBand: ageBandForAge(PERSONA_AGE[personaId]), state: PERSONA_STATE[personaId] };
}
