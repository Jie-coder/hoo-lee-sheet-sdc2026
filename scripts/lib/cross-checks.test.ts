import { describe, expect, it } from "vitest";
import { runCrossChecks } from "./cross-checks";

describe("runCrossChecks", () => {
  it("flags a duplicate course id and reports the second occurrence's row", () => {
    const issues = runCrossChecks({
      courses: [
        { row: 2, id: "c001", skills: [], skillUris: [] },
        { row: 3, id: "c001", skills: [], skillUris: [] },
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({ file: "courses.csv", row: 3, column: "id", severity: "error" }),
    ]);
  });

  it("does not flag two different ids", () => {
    const issues = runCrossChecks({
      courses: [
        { row: 2, id: "c001", skills: [], skillUris: [] },
        { row: 3, id: "c002", skills: [], skillUris: [] },
      ],
    });
    expect(issues).toEqual([]);
  });

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
