import { describe, expect, it } from "vitest";
import { EN, MS } from "./i18n";

// The EN and BM UI must not show Chinese/Japanese/Korean text. The only
// exception is the endonym for the Chinese course language ("中文").
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
const ALLOWED = new Set(["interview.languageZh", "pathway.language.zh", "courseLanguageToggle.zh"]);

describe.each([
  ["EN", EN],
  ["MS", MS],
])("%s dictionary", (_name, dict) => {
  it("has no CJK text outside the Chinese language-name labels", () => {
    const offenders = Object.entries(dict as Record<string, string>)
      .filter(([key, value]) => !ALLOWED.has(key) && CJK.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});
