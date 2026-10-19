// Turns a Zod 4 SafeParseError into report Issues, mapping each issue's path
// back to the snake_case CSV column it came from.
import type { z } from "zod";
import type { Issue } from "./report";

function camelToSnake(value: string): string {
  return value.replace(/([A-Z])/g, "_$1").toLowerCase();
}

type EnumIssue = { code: "invalid_value"; values?: unknown[] };
type FormatIssue = { code: "invalid_format"; format?: string };

function hintFor(issue: z.core.$ZodIssue): string | undefined {
  if (issue.code === "invalid_value") {
    const values = (issue as EnumIssue).values;
    if (Array.isArray(values) && values.length > 0) {
      return `use one of: ${values.join(", ")}`;
    }
  }
  if (issue.code === "invalid_format") {
    const format = (issue as FormatIssue).format;
    if (format === "date") return "use YYYY-MM-DD";
    if (format === "url") return "must be a full URL, e.g. https://example.com";
  }
  if (issue.code === "too_small") return "value is required / too short";
  return undefined;
}

/**
 * Maps a ZodError's issues to report Issues for one CSV row. `columnOverrides`
 * lets a caller redirect a derived field (for example `skillIds`) back to the
 * CSV column it was built from (`skills`).
 */
export function zodErrorToIssues(
  error: z.ZodError,
  options: {
    file: string;
    row: number;
    raw: Record<string, string>;
    columnOverrides?: Record<string, string>;
  }
): Issue[] {
  const overrides = options.columnOverrides ?? {};
  return error.issues.map((issue) => {
    const path = issue.path.map(String);
    const joined = path.join(".");
    const last = path[path.length - 1];
    const column = overrides[joined] ?? overrides[last] ?? (last ? camelToSnake(last) : undefined);
    return {
      file: options.file,
      row: options.row,
      column,
      value: column !== undefined ? options.raw[column] : undefined,
      message: issue.message,
      hint: hintFor(issue),
      severity: "error" as const,
    };
  });
}
