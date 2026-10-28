// The SDG target a skill contributes to, via its ESCO skill group:
// skill id -> group id (data/skill_groups.csv) -> target + reason
// (data/skill_group_sdg.csv). Null when the skill or its group has no link.
import { CATALOGUE, type Catalogue } from "./catalogue";
import type { SdgTargetId } from "@/types/contracts";

export type SkillSdg = {
  target: SdgTargetId;
  reason: string;
};

export function skillSdg(
  skillId: string,
  catalogue: Pick<Catalogue, "skillGroups" | "groupSdg"> = CATALOGUE,
): SkillSdg | null {
  const groupId = catalogue.skillGroups[skillId];
  if (!groupId) return null;
  return catalogue.groupSdg[groupId] ?? null;
}
