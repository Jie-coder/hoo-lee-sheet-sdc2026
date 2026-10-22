import { describe, expect, it } from "vitest";
import { translate, type SiteLocale } from "./i18n";
import { localizeStatusLabel } from "./status-label";

function localize(label: string, locale: SiteLocale): string {
  return localizeStatusLabel(label, (key, vars) => translate(locale, key, vars));
}

describe("localizeStatusLabel", () => {
  it("translates the robust label", () => {
    expect(localize("Robust in all 3 futures", "en")).toBe("Robust in all 3 futures");
    expect(localize("Robust in all 3 futures", "ms")).toBe(
      "Kukuh dalam ketiga-tiga senario masa depan",
    );
  });

  it("translates the interest label and its interest name", () => {
    expect(localize("Matches your interest: health", "en")).toBe("Matches your interest: health");
    expect(localize("Matches your interest: health", "ms")).toBe(
      "Padan dengan minat anda: kesihatan",
    );
  });

  it("translates the top-in label and every scenario short name", () => {
    expect(localize("Top 3 in Co-Pilot and Supercharged only", "en")).toBe(
      "Top 3 in Co-Pilot and Supercharged only",
    );
    expect(localize("Top 3 in Co-Pilot and Supercharged only", "ms")).toBe(
      "3 teratas dalam Co-Pilot dan Dipercepatkan sahaja",
    );
  });

  it("returns unknown labels unchanged", () => {
    expect(localize("Something else", "ms")).toBe("Something else");
    expect(localize("Top 3 in Unknown only", "ms")).toBe("Top 3 in Unknown only");
  });
});
