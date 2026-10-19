import { describe, expect, it } from "vitest";
import {
  escoUriToId,
  isBlank,
  isEscoUri,
  parseIntOrBlank,
  parseNumber,
  parseYesNo,
  parseYesNoOrBlank,
  splitCodes,
  splitNames,
} from "./cells";

describe("splitCodes", () => {
  it("splits on comma and trims whitespace", () => {
    expect(splitCodes("en, ms , zh")).toEqual(["en", "ms", "zh"]);
  });
  it("drops empty items", () => {
    expect(splitCodes("en,,ms,")).toEqual(["en", "ms"]);
  });
  it("does not split on a semicolon", () => {
    expect(splitCodes("en;ms")).toEqual(["en;ms"]);
  });
});

describe("splitNames", () => {
  it("splits on semicolon and trims whitespace", () => {
    expect(splitNames("Data analysis; Communication ")).toEqual(["Data analysis", "Communication"]);
  });
  it("does not split on a comma", () => {
    expect(splitNames("Spreadsheets, Pivot Tables")).toEqual(["Spreadsheets, Pivot Tables"]);
  });
});

describe("isBlank", () => {
  it("is true for empty or whitespace-only strings", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });
  it("is false for a non-empty value", () => {
    expect(isBlank("yes")).toBe(false);
  });
});

describe("parseYesNoOrBlank", () => {
  it("maps yes/no case-insensitively", () => {
    expect(parseYesNoOrBlank("Yes")).toEqual({ ok: true, value: true });
    expect(parseYesNoOrBlank("no")).toEqual({ ok: true, value: false });
  });
  it("maps blank to null", () => {
    expect(parseYesNoOrBlank("")).toEqual({ ok: true, value: null });
  });
  it("rejects anything else", () => {
    const result = parseYesNoOrBlank("maybe");
    expect(result.ok).toBe(false);
  });
});

describe("parseYesNo", () => {
  it("rejects blank (unlike parseYesNoOrBlank)", () => {
    expect(parseYesNo("").ok).toBe(false);
  });
});

describe("parseIntOrBlank", () => {
  it("parses a whole number", () => {
    expect(parseIntOrBlank("42")).toEqual({ ok: true, value: 42 });
  });
  it("maps blank to null", () => {
    expect(parseIntOrBlank("")).toEqual({ ok: true, value: null });
  });
  it("rejects a decimal or negative value", () => {
    expect(parseIntOrBlank("4.5").ok).toBe(false);
    expect(parseIntOrBlank("-1").ok).toBe(false);
  });
});

describe("parseNumber", () => {
  it("parses an integer or decimal", () => {
    expect(parseNumber("20")).toEqual({ ok: true, value: 20 });
    expect(parseNumber("0.62")).toEqual({ ok: true, value: 0.62 });
  });
  it("rejects a blank or non-numeric value", () => {
    expect(parseNumber("").ok).toBe(false);
    expect(parseNumber("abc").ok).toBe(false);
  });
});

describe("isEscoUri", () => {
  it("accepts a well-formed ESCO skill or occupation URI", () => {
    expect(isEscoUri("https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000001")).toBe(
      true
    );
    expect(
      isEscoUri("https://data.europa.eu/esco/occupation/00000000-0000-0000-0000-000000000001")
    ).toBe(true);
  });
  it("rejects a non-ESCO URL or a malformed id", () => {
    expect(isEscoUri("https://example.com/skill/1")).toBe(false);
    expect(isEscoUri("not-a-url")).toBe(false);
  });
});

describe("escoUriToId", () => {
  it("returns the last path segment, lower-cased", () => {
    expect(escoUriToId("https://data.europa.eu/esco/skill/ABCDEF00-0000-0000-0000-000000000001")).toBe(
      "abcdef00-0000-0000-0000-000000000001"
    );
  });
});
