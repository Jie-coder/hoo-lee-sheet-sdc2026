import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { detectCurrentOccupationId, lookupRoleAlias, normalizeAliasKey, ROLE_ALIASES } from "@/lib/role-aliases";
import raw from "@/data/role-aliases.json";

const ids = new Set(CATALOGUE.occupations.map((o) => o.id));

describe("role-aliases.json", () => {
  it("has a few hundred entries", () => {
    expect(Object.keys(ROLE_ALIASES).length).toBeGreaterThanOrEqual(250);
  });
  it("every roleId is a catalogue id or null", () => {
    for (const [key, entry] of Object.entries(ROLE_ALIASES)) {
      expect(entry.roleId === null || ids.has(entry.roleId), key).toBe(true);
    }
  });
  it("every key is already normalized and unique after normalization", () => {
    const keys = Object.keys(raw);
    for (const key of keys) expect(normalizeAliasKey(key), key).toBe(key);
    expect(new Set(keys.map(normalizeAliasKey)).size).toBe(keys.length);
  });
});

describe("lookupRoleAlias", () => {
  it("normalizes case, punctuation and spacing", () => {
    expect(lookupRoleAlias("  UI/UX   Designer! ")).toBe("o007");
    expect(lookupRoleAlias("Pembantu  Tadbir")).toBe("o038");
  });
  it("distinguishes null (known, no match) from undefined (not in table)", () => {
    expect(lookupRoleAlias("Peguam")).toBeNull();
    expect(lookupRoleAlias("underwater basket weaver")).toBeUndefined();
  });
});

describe("detectCurrentOccupationId", () => {
  const occupations = [
    { id: "o038", title: "Administrative assistant" },
    { id: "o001", title: "Data analyst" },
  ];
  it("matches an exact catalogue title, case and punctuation aside", () => {
    expect(detectCurrentOccupationId("  administrative Assistant. ", occupations)).toBe("o038");
  });
  it("falls back to the alias table", () => {
    expect(detectCurrentOccupationId("Customer Support Agent", occupations)).toBe("o036");
  });
  it("returns null for empty or unknown titles", () => {
    expect(detectCurrentOccupationId(undefined, occupations)).toBeNull();
    expect(detectCurrentOccupationId("", occupations)).toBeNull();
    expect(detectCurrentOccupationId("Senior Accounts Assistant", occupations)).toBeNull();
  });
});
