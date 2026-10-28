import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./catalogue";
import { skillSdg } from "./skill-sdg";

describe("skillSdg", () => {
  it("returns the target and reason for a skill whose ESCO group has one", () => {
    // statistics -> SDG 17.19
    expect(skillSdg("7ee4c2ea-b349-4bd2-81a3-ec31475d4833")).toEqual({
      target: "17.19",
      reason: "Statisticians build the measures countries need to track development.",
    });
  });

  it("returns null for a skill whose group has no SDG link", () => {
    // protecting and enforcing is not mapped in skill_group_sdg.csv.
    expect(skillSdg("000709ed-2be5-4193-b056-45a97698d828")).toBeNull();
  });

  it("returns null for a skill that has no ESCO group or does not exist", () => {
    expect(skillSdg("laluan:office-automation")).toBeNull();
    expect(skillSdg("not-a-real-skill")).toBeNull();
  });

  it("uses the groupSdg entry the catalogue build added for the skill's group", () => {
    for (const [skillId, groupId] of Object.entries(CATALOGUE.skillGroups)) {
      const entry = skillSdg(skillId);
      if (!entry) continue;
      expect(CATALOGUE.groupSdg[groupId]).toEqual(entry);
    }
  });
});
