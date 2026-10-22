import { describe, expect, it } from "vitest";
import { EN, MS, translate } from "./i18n";

describe("i18n dictionaries", () => {
  it("has a non-empty BM string for every EN key", () => {
    const missing = Object.keys(EN).filter((key) => !(MS as Record<string, string>)[key]?.trim());
    expect(missing).toEqual([]);
  });

  it("has no BM keys that EN lacks", () => {
    expect(Object.keys(MS).filter((key) => !(key in EN))).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
    const keys = Object.keys(EN) as (keyof typeof EN)[];
    expect(keys.filter((key) => vars(EN[key]) !== vars(MS[key]))).toEqual([]);
  });

  it("interpolates variables", () => {
    expect(translate("ms", "results.headingNamed", { name: "Aisyah" })).toBe("Laluan masa depan Aisyah");
  });
});
