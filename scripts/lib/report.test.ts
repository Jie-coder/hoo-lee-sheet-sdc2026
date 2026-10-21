import { describe, expect, it } from "vitest";
import { exitCodeFor, formatReport, issueCount, type FullReport } from "./report";

function reportWith(issues: FullReport["files"][number]["issues"]): FullReport {
  return {
    files: [
      {
        file: "courses.csv",
        present: true,
        totalRows: 1,
        validRows: issues.length === 0 ? 1 : 0,
        invalidRows: issues.length === 0 ? 0 : 1,
        issues,
      },
    ],
    crossFileIssues: [],
  };
}

describe("exitCodeFor", () => {
  it("is 0 when there are no errors", () => {
    expect(exitCodeFor(reportWith([]))).toBe(0);
  });

  it("is 0 when there are only warnings", () => {
    const report = reportWith([
      { file: "courses.csv", row: 2, column: "notes", message: "fyi", severity: "warning" },
    ]);
    expect(exitCodeFor(report)).toBe(0);
  });

  it("is non-zero when there is at least one error", () => {
    const report = reportWith([
      { file: "courses.csv", row: 2, column: "cost_type", message: "bad", severity: "error" },
    ]);
    expect(exitCodeFor(report)).toBe(1);
  });

  it("counts an error inside crossFileIssues too", () => {
    const report: FullReport = {
      files: [],
      crossFileIssues: [{ file: "cross-file", message: "duplicate", severity: "error" }],
    };
    expect(exitCodeFor(report)).toBe(1);
    expect(issueCount(report, "error")).toBe(1);
  });
});

describe("formatReport", () => {
  it("includes the row, column, and totals in the printed text", () => {
    const report = reportWith([
      {
        file: "courses.csv",
        row: 7,
        column: "cost_type",
        value: "freemium",
        message: "bad cost_type",
        hint: "use one of: free, paid",
        severity: "error",
      },
    ]);
    const text = formatReport(report);
    expect(text).toContain("row 7");
    expect(text).toContain('column "cost_type"');
    expect(text).toContain("freemium");
    expect(text).toContain("use one of: free, paid");
    expect(text).toContain("1 error(s)");
  });

  it("notes a missing file without counting it as an error", () => {
    const report: FullReport = {
      files: [
        {
          file: "programmes.csv",
          present: false,
          note: "not found, skipped",
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          issues: [],
        },
      ],
      crossFileIssues: [],
    };
    expect(exitCodeFor(report)).toBe(0);
    expect(formatReport(report)).toContain("not found, skipped");
  });
});
