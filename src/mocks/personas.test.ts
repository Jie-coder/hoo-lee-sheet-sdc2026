import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ParsedCVSchema, LANGUAGE_CODES } from "@/types/contracts";
import { PERSONA_IDS, PERSONAS } from "./personas";

describe("Profile personas", () => {
  it("has exactly the three synthetic CVs from docs/personas.md", () => {
    expect(PERSONA_IDS).toEqual(["aisyah", "lim-jia-hui", "pravin"]);
    expect(Object.keys(PERSONAS)).toEqual(PERSONA_IDS);
  });

  for (const id of PERSONA_IDS) {
    it(`${id}: parses against ParsedCVSchema and points at a real sample PDF`, () => {
      const persona = PERSONAS[id];
      expect(() => ParsedCVSchema.parse(persona.parsed)).not.toThrow();
      expect(persona.parsed.roles.length).toBeGreaterThan(0);
      expect(persona.parsed.skills.length).toBeGreaterThan(0);

      for (const language of persona.courseLanguages) {
        expect(LANGUAGE_CODES).toContain(language);
      }

      for (const skill of persona.unmatchedSkills) {
        expect(persona.parsed.skills).toContain(skill);
      }

      expect(persona.cvUrl).toMatch(/^\/samples\/.+\.pdf$/);
      const samplePath = path.join(process.cwd(), "public", persona.cvUrl);
      expect(fs.existsSync(samplePath)).toBe(true);
    });
  }
});
