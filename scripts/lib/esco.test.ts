import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import {
  DEFAULT_ESCO_VERSION,
  escoOccupationUrl,
  formatOccupationSkillsCsv,
  occupationSkillRowsFromEsco,
  OCCUPATION_SKILLS_HEADER,
  type EscoOccupationResponse,
} from "./esco";
import { FILE_SPECS } from "./files";
import { mapOccupationSkillRow } from "./mappers";

const SKILL = (n: number) => `http://data.europa.eu/esco/skill/00000000-0000-0000-0000-00000000000${n}`;

const response: EscoOccupationResponse = {
  uri: "http://data.europa.eu/esco/occupation/f2b15a0e-e65a-438a-affb-29b9d50b77d1",
  title: "software developer",
  _links: {
    hasEssentialSkill: [
      { uri: SKILL(2), title: "computer programming" },
      { uri: SKILL(1), title: "analyse software specifications" },
      { uri: SKILL(1), title: "analyse software specifications" },
      { title: "no uri, dropped" },
    ],
    hasOptionalSkill: [
      { uri: SKILL(3), title: "VBScript" },
      { uri: SKILL(2), title: "computer programming" },
    ],
  },
};

describe("occupationSkillRowsFromEsco", () => {
  it("copies essential skills only by default, sorted, without duplicates or blank links", () => {
    const rows = occupationSkillRowsFromEsco("o001", response, { includeOptional: false, asOf: "2026-10-21" });
    expect(rows.map((row) => [row.skillLabel, row.relation])).toEqual([
      ["analyse software specifications", "essential"],
      ["computer programming", "essential"],
    ]);
    expect(rows.every((row) => row.sourceName === "ESCO" && row.asOf === "2026-10-21")).toBe(true);
  });

  it("adds optional skills when asked, and a skill listed as both stays essential", () => {
    const rows = occupationSkillRowsFromEsco("o001", response, { includeOptional: true, asOf: "2026-10-21" });
    expect(rows.map((row) => [row.skillLabel, row.relation])).toEqual([
      ["analyse software specifications", "essential"],
      ["computer programming", "essential"],
      ["VBScript", "optional"],
    ]);
  });

  it("returns no rows for a response without skill links", () => {
    expect(occupationSkillRowsFromEsco("o001", {}, { includeOptional: true, asOf: "2026-10-21" })).toEqual([]);
  });
});

describe("escoOccupationUrl", () => {
  it("pins the ESCO version and encodes the occupation URI", () => {
    const url = new URL(escoOccupationUrl(response.uri as string, DEFAULT_ESCO_VERSION));
    expect(url.searchParams.get("uri")).toBe(response.uri);
    expect(url.searchParams.get("selectedVersion")).toBe("v1.2.1");
    expect(url.searchParams.get("language")).toBe("en");
  });
});

describe("formatOccupationSkillsCsv", () => {
  it("writes the header the importer expects and round-trips through the importer's mapper", () => {
    expect([...OCCUPATION_SKILLS_HEADER]).toEqual(FILE_SPECS.occupation_skills.headers);

    const rows = occupationSkillRowsFromEsco(
      "o001",
      { _links: { hasEssentialSkill: [{ uri: SKILL(4), title: 'use "quotes", commas' }] } },
      { includeOptional: false, asOf: "2026-10-21" }
    );
    const { header, rows: cells } = parseCsv(formatOccupationSkillsCsv(rows));
    const raw = Object.fromEntries(header.map((column, i) => [column, cells[0][i]]));
    const mapped = mapOccupationSkillRow(raw, 2);

    expect(mapped.issues).toEqual([]);
    expect(mapped.value).toEqual(rows[0]);
  });
});

describe("mapOccupationSkillRow", () => {
  const good = {
    occupation_id: "o001",
    skill_uri: SKILL(1),
    skill_label: "analyse software specifications",
    relation: "essential",
    source_name: "ESCO",
    as_of: "2026-10-21",
  };

  it("rejects an occupation URI in skill_uri", () => {
    const result = mapOccupationSkillRow({ ...good, skill_uri: response.uri as string }, 2);
    expect(result.value).toBeNull();
    expect(result.issues[0]).toMatchObject({ column: "skill_uri", severity: "error" });
  });

  it("rejects a relation other than essential or optional", () => {
    const result = mapOccupationSkillRow({ ...good, relation: "required" }, 3);
    expect(result.value).toBeNull();
    expect(result.issues.some((issue) => issue.column === "relation")).toBe(true);
  });
});
