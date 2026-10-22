import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ParsedCVSchema, LANGUAGE_CODES } from "@/types/contracts";
import { PERSONA_IDS, PERSONAS } from "./personas";

/** demo/cv/*.pdf filenames, by persona id (not a fixed pattern off the id). */
const DEMO_CV_FILENAMES: Record<string, string> = {
  aisyah: "cv-aisyah-binti-rahman.pdf",
  "lim-jia-hui": "cv-lim-jia-hui.pdf",
  pravin: "cv-pravin-a-l-murugan.pdf",
};

describe("Profile personas", () => {
  it("has exactly the three synthetic CVs from docs/personas.md", () => {
    expect(PERSONA_IDS).toEqual(["aisyah", "lim-jia-hui", "pravin"]);
    expect(Object.keys(PERSONAS)).toEqual(PERSONA_IDS);
  });

  for (const id of PERSONA_IDS) {
    it(`${id}: parses against ParsedCVSchema and has a real demo PDF under demo/cv/`, () => {
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

      // The real PDF lives outside public/ (never served or downloadable):
      // demo/cv/, used only by scripts/precompute-demo-cvs.ts.
      const demoPath = path.join(process.cwd(), "demo", "cv", DEMO_CV_FILENAMES[id]);
      expect(fs.existsSync(demoPath)).toBe(true);
    });
  }
});
