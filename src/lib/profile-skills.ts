// Turns the profile page's skill chips into ESCO skills for scoring.
// Sample personas use the hand-checked mapping in data/persona_skills.csv.
// A skill the user typed counts only when it is exactly an ESCO skill label
// we know (case-insensitive), at half weight. Nothing is guessed.
import type { Catalogue } from "@/lib/catalogue";
import type { ProfileSkill } from "@/lib/analyze";

export type ProfileSkillChip = { label: string; selfReported: boolean };

export type SkillMatch = { label: string; escoLabels: string[] };

const CV_LEVEL = 1;
const SELF_REPORTED_LEVEL = 0.5;

export function resolveProfileSkills(
  catalogue: Catalogue,
  personaId: string,
  chips: readonly ProfileSkillChip[],
): { skills: ProfileSkill[]; matches: SkillMatch[] } {
  const personaRows = catalogue.personaSkills[personaId] ?? [];
  const byLabel = new Map<string, string>();
  for (const [id, label] of Object.entries(catalogue.skills)) byLabel.set(label.toLowerCase(), id);

  const skills: ProfileSkill[] = [];
  const matches: SkillMatch[] = [];
  for (const chip of chips) {
    const fromCv = chip.selfReported ? [] : personaRows.filter((row) => row.cvSkill === chip.label);
    if (fromCv.length > 0) {
      for (const row of fromCv) skills.push({ skillId: row.skillId, level: CV_LEVEL });
      matches.push({ label: chip.label, escoLabels: fromCv.map((row) => row.label) });
      continue;
    }
    const exactId = byLabel.get(chip.label.trim().toLowerCase());
    if (exactId) {
      skills.push({ skillId: exactId, level: chip.selfReported ? SELF_REPORTED_LEVEL : CV_LEVEL });
      matches.push({ label: chip.label, escoLabels: [catalogue.skills[exactId]] });
    } else {
      matches.push({ label: chip.label, escoLabels: [] });
    }
  }
  return { skills, matches };
}
