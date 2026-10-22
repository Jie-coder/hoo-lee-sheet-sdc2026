import { describe, expect, it } from "vitest";
import { duplicateIssues, runCrossChecks } from "./cross-checks";

describe("duplicateIssues", () => {
  it("flags a duplicate key and reports the second occurrence's row", () => {
    const issues = duplicateIssues("courses.csv", "id", [
      { row: 2, key: "c001" },
      { row: 3, key: "c001" },
    ]);
    expect(issues).toEqual([
      expect.objectContaining({ file: "courses.csv", row: 3, column: "id", severity: "error" }),
    ]);
  });

  it("does not flag two different keys", () => {
    const issues = duplicateIssues("courses.csv", "id", [
      { row: 2, key: "c001" },
      { row: 3, key: "c002" },
    ]);
    expect(issues).toEqual([]);
  });

  it("ignores blank keys", () => {
    const issues = duplicateIssues("courses.csv", "id", [
      { row: 2, key: "" },
      { row: 3, key: "" },
    ]);
    expect(issues).toEqual([]);
  });
});

describe("runCrossChecks", () => {
  it("warns when the same skill URI is used with two different names", () => {
    const issues = runCrossChecks({
      courses: [{ row: 2, id: "c001", skills: ["Data analysis"], skillUris: ["https://data.europa.eu/esco/skill/x"] }],
      keywords: [
        {
          row: 2,
          keyword: "k1",
          skills: ["Data analytics"],
          skillUris: ["https://data.europa.eu/esco/skill/x"],
        },
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({ severity: "warning", message: expect.stringContaining("different names") }),
    ]);
  });

  it("warns when exposure.source_name is not in sources.csv", () => {
    const issues = runCrossChecks({
      exposure: [{ row: 2, occupation: "Data Analyst", code: "2512", sourceName: "Unknown Source" }],
      sources: [{ row: 2, name: "Known Source" }],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        file: "exposure.csv",
        row: 2,
        column: "source_name",
        severity: "warning",
      }),
    ]);
  });

  it("does not warn about source_name when sources.csv was not read", () => {
    const issues = runCrossChecks({
      exposure: [{ row: 2, occupation: "Data Analyst", code: "2512", sourceName: "Unknown Source" }],
    });
    expect(issues).toEqual([]);
  });

  it("warns when exposure.occupation/code does not match occupations.csv", () => {
    const issues = runCrossChecks({
      exposure: [{ row: 2, occupation: "Mystery Job", code: "9999", sourceName: "" }],
      occupations: [{ row: 2, id: "o001", escoUri: null, iscoCode: "2512", titleEn: "Data Analyst" }],
    });
    expect(issues).toEqual([
      expect.objectContaining({ file: "exposure.csv", row: 2, column: "occupation", severity: "warning" }),
    ]);
  });

  it("matches exposure to occupations.csv by code even when the title differs", () => {
    const issues = runCrossChecks({
      exposure: [{ row: 2, occupation: "Data Analyst (alt title)", code: "2512", sourceName: "" }],
      occupations: [{ row: 2, id: "o001", escoUri: null, iscoCode: "2512", titleEn: "Data Analyst" }],
    });
    expect(issues).toEqual([]);
  });
});

describe("runCrossChecks: occupation_skills.csv", () => {
  const occupations = [{ row: 2, id: "o001", escoUri: null, iscoCode: "2512", titleEn: "Data Analyst" }];
  const sources = [{ row: 2, name: "ESCO" }];

  it("errors on an occupation_id that is not in occupations.csv (a foreign key --apply would reject)", () => {
    const issues = runCrossChecks({
      occupations,
      sources,
      occupationSkills: [
        { row: 2, occupationId: "o001", sourceName: "ESCO" },
        { row: 3, occupationId: "o999", sourceName: "ESCO" },
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        file: "occupation_skills.csv",
        row: 3,
        column: "occupation_id",
        value: "o999",
        severity: "error",
      }),
    ]);
  });

  it("warns once per unknown source_name, not once per row", () => {
    const issues = runCrossChecks({
      occupations,
      sources,
      occupationSkills: [
        { row: 2, occupationId: "o001", sourceName: "Esco" },
        { row: 3, occupationId: "o001", sourceName: "Esco" },
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({ file: "occupation_skills.csv", row: 2, column: "source_name", severity: "warning" }),
    ]);
  });
});
