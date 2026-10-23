import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { isCustomSkillId, isEscoUri, skillRefToId } from "./cells";
import { mapCourseRow } from "./mappers";
import { deriveSkills } from "../import-data";
import { buildCatalogue } from "./catalogue-build";

const DATA_DIR = join(__dirname, "../../data");

describe("Laluan custom skills", () => {
  it("recognises laluan: ids and never treats them as ESCO", () => {
    expect(isCustomSkillId("laluan:office-automation")).toBe(true);
    expect(isCustomSkillId("laluan:Office Automation")).toBe(false);
    expect(isCustomSkillId("http://data.europa.eu/esco/skill/5063a99f-975b-4a7c-85e3-69ecb375b4d3")).toBe(false);
    expect(isEscoUri("laluan:office-automation")).toBe(false);
    expect(skillRefToId("laluan:office-automation")).toBe("laluan:office-automation");
  });

  it("accepts a course tagged with a custom skill and keeps its id", () => {
    const result = mapCourseRow(
      {
        id: "c999",
        title: "Test course",
        provider: "Test",
        url: "https://example.com/course",
        languages: "en",
        hours: "2",
        cost_type: "free",
        certificate: "no",
        skills: "automate office workflows",
        skill_uris: "laluan:office-automation",
        sdg_target: "4.4",
        sdg_reason: "reason",
        summary: "summary",
        last_checked: "2026-10-23",
        notes: "",
        mode: "online",
        ai_content: "digital",
      },
      2
    );
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.value?.skillIds).toEqual(["laluan:office-automation"]);
  });

  it("still rejects a malformed custom id", () => {
    const result = mapCourseRow({ skill_uris: "laluan:Bad Id", skills: "x" } as Record<string, string>, 2);
    expect(result.issues.some((issue) => issue.column === "skill_uris")).toBe(true);
  });

  it("gives a custom skill no ESCO URI", () => {
    const [skill] = deriveSkills([{ skills: ["automate office workflows"], skillUris: ["laluan:office-automation"] }]);
    expect(skill).toEqual({ id: "laluan:office-automation", escoUri: null, labelEn: "automate office workflows" });
  });

  it("defines every custom skill the catalogue uses, labelled from custom_skills.csv", () => {
    const catalogue = buildCatalogue(DATA_DIR);
    const used = new Set(catalogue.courses.flatMap((course) => course.skillIds).filter(isCustomSkillId));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) {
      expect(catalogue.customSkills[id]).toBeDefined();
      expect(catalogue.skills[id]).toBe(catalogue.customSkills[id].label);
      expect(catalogue.customSkills[id].description).toMatch(/not an ESCO concept/);
    }
  });
});
