// Report types shared across parsing, mapping, and cross-file checks, plus
// the console printer. Row numbers follow the spreadsheet convention: the
// header is row 1, so the first data row is row 2.

export type Severity = "error" | "warning";

export type Issue = {
  file: string;
  /** Spreadsheet row number (header = 1). Omitted for file-level issues. */
  row?: number;
  /** snake_case CSV column name, or undefined for a file-level issue. */
  column?: string;
  /** The raw cell value that triggered the issue, when there is one. */
  value?: string;
  message: string;
  hint?: string;
  severity: Severity;
};

export type FileReport = {
  file: string;
  present: boolean;
  note?: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: Issue[];
};

export type FullReport = {
  files: FileReport[];
  crossFileIssues: Issue[];
};

export function issueCount(report: FullReport, severity: Severity): number {
  const fromFiles = report.files.reduce(
    (total, file) => total + file.issues.filter((issue) => issue.severity === severity).length,
    0
  );
  const fromCrossFile = report.crossFileIssues.filter((issue) => issue.severity === severity).length;
  return fromFiles + fromCrossFile;
}

/** Exit code the CLI should use: non-zero whenever any error was reported. */
export function exitCodeFor(report: FullReport): number {
  return issueCount(report, "error") > 0 ? 1 : 0;
}

function formatIssue(issue: Issue, options: { includeFile?: boolean } = {}): string {
  const location = [
    options.includeFile ? issue.file : null,
    issue.row !== undefined ? `row ${issue.row}` : null,
    issue.column !== undefined ? `column "${issue.column}"` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const parts = [`[${issue.severity.toUpperCase()}]`];
  if (location) parts.push(location + ":");
  parts.push(issue.message);
  if (issue.value !== undefined) parts.push(`(value: "${issue.value}")`);
  if (issue.hint) parts.push(`— ${issue.hint}`);
  return parts.join(" ");
}

/** Renders the full report as plain text, suitable for console.log. */
export function formatReport(report: FullReport): string {
  const lines: string[] = [];

  for (const file of report.files) {
    lines.push(`\n${file.file}`);
    if (!file.present) {
      lines.push(`  ${file.note ?? "not found, skipped"}`);
      continue;
    }
    for (const issue of file.issues) {
      lines.push(`  ${formatIssue(issue)}`);
    }
    lines.push(
      `  rows: ${file.totalRows}, valid: ${file.validRows}, invalid: ${file.invalidRows}`
    );
  }

  if (report.crossFileIssues.length > 0) {
    lines.push(`\ncross-file checks`);
    for (const issue of report.crossFileIssues) {
      lines.push(`  ${formatIssue(issue, { includeFile: true })}`);
    }
  }

  const totalRows = report.files.reduce((total, file) => total + file.totalRows, 0);
  const totalValid = report.files.reduce((total, file) => total + file.validRows, 0);
  const totalInvalid = report.files.reduce((total, file) => total + file.invalidRows, 0);
  const errors = issueCount(report, "error");
  const warnings = issueCount(report, "warning");

  lines.push(
    `\ntotal: ${report.files.filter((f) => f.present).length} file(s) read, ${totalRows} row(s), ${totalValid} valid, ${totalInvalid} invalid, ${errors} error(s), ${warnings} warning(s)`
  );

  return lines.join("\n");
}
