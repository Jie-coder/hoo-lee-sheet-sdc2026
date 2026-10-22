import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCatalogue } from "./catalogue-build";
import { CATALOGUE_PATH, formatCatalogue } from "../build-catalogue";

describe("src/data/catalogue.json", () => {
  it("is up to date with data/*.csv (run `npm run build-catalogue` after changing data/)", () => {
    const fresh = formatCatalogue(buildCatalogue("data"));
    expect(readFileSync(CATALOGUE_PATH, "utf8")).toBe(fresh);
  });

  it("has an SDG target, exposure figure and essential skills for every occupation", () => {
    const catalogue = buildCatalogue("data");
    for (const occupation of catalogue.occupations) {
      expect(occupation.sdg.length, occupation.id).toBeGreaterThan(0);
      expect(occupation.exposure, occupation.id).not.toBeNull();
      expect(occupation.essentialSkillIds.length, occupation.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("averages keyword momentum per skill instead of summing counts", () => {
    const catalogue = buildCatalogue("data");
    const manageData = catalogue.signals["9ff9db9d-d14b-426e-83f3-e7449af6c79f"];
    // Several keywords map to "manage data"; each contributes its own momentum.
    expect(manageData.keywords.length).toBeGreaterThan(1);
    expect(Math.abs(manageData.momentum)).toBeLessThan(1);
  });
});
