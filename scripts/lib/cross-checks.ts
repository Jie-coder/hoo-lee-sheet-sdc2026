// Checks that span more than one row or more than one file. These never
// block a single row from being otherwise valid; they report into their own
// section of the output (report.crossFileIssues). Within-file checks (like
// duplicate ids) are computed per file in import-data.ts so they print under
// that file's own section instead.
import type { Issue } from "./report";

export type CourseCrossRow = { row: number; id: string; skills: string[]; skillUris: string[] };
export type SourceCrossRow = { row: number; name: string };
export type KeywordCrossRow = { row: number; keyword: string; skills: string[]; skillUris: string[] };
export type ExposureCrossRow = { row: number; occupation: string; code: string; sourceName: string };
export type OccupationCrossRow = {
  row: number;
  id: string;
  escoUri: string | null;
  iscoCode: string | null;
  titleEn: string;
};

export type CrossCheckInput = {
  courses?: CourseCrossRow[];
  sources?: SourceCrossRow[];
  keywords?: KeywordCrossRow[];
  exposure?: ExposureCrossRow[];
  occupations?: OccupationCrossRow[];
};

/**
 * Flags every row after the first whose `key` repeats an earlier row's.
 * Exported for import-data.ts, which runs this per file so duplicate-id
 * issues print under that file's own section rather than cross-file checks.
 */
export function duplicateIssues(
  file: string,
  column: string,
  rows: { row: number; key: string }[]
): Issue[] {
  const firstSeenAt = new Map<string, number>();
  const issues: Issue[] = [];
  for (const { row, key } of rows) {
    if (key.length === 0) continue;
    const first = firstSeenAt.get(key);
    if (first === undefined) {
      firstSeenAt.set(key, row);
      continue;
    }
    issues.push({
      file,
      row,
      column,
      value: key,
      message: `"${key}" is already used on row ${first}`,
      hint: `every ${column} in ${file} must be unique`,
      severity: "error",
    });
  }
  return issues;
}

/** Runs every genuinely cross-file check and returns the combined issue list. */
export function runCrossChecks(input: CrossCheckInput): Issue[] {
  const issues: Issue[] = [];

  // Same skill URI mapped to different names across courses.csv and
  // keywords.csv: likely a typo in one of the names.
  const uriToNames = new Map<string, Set<string>>();
  const uriToFirstFile = new Map<string, string>();
  const registerSkillPairs = (file: string, rows: { skills: string[]; skillUris: string[] }[]) => {
    for (const row of rows) {
      const count = Math.min(row.skills.length, row.skillUris.length);
      for (let i = 0; i < count; i += 1) {
        const uri = row.skillUris[i];
        const name = row.skills[i];
        if (!uriToNames.has(uri)) {
          uriToNames.set(uri, new Set());
          uriToFirstFile.set(uri, file);
        }
        uriToNames.get(uri)?.add(name);
      }
    }
  };
  if (input.courses) registerSkillPairs("courses.csv", input.courses);
  if (input.keywords) registerSkillPairs("keywords.csv", input.keywords);

  for (const [uri, names] of uriToNames) {
    if (names.size > 1) {
      issues.push({
        file: uriToFirstFile.get(uri) ?? "courses.csv",
        column: "skills",
        value: uri,
        message: `skill URI ${uri} is used with ${names.size} different names: ${Array.from(names).join(", ")}`,
        hint: "use one name per ESCO URI across courses.csv and keywords.csv",
        severity: "warning",
      });
    }
  }

  // exposure.source_name should name a row in sources.csv, when sources.csv is present.
  if (input.exposure && input.sources) {
    const sourceNames = new Set(input.sources.map((row) => row.name));
    for (const row of input.exposure) {
      if (row.sourceName.length > 0 && !sourceNames.has(row.sourceName)) {
        issues.push({
          file: "exposure.csv",
          row: row.row,
          column: "source_name",
          value: row.sourceName,
          message: `"${row.sourceName}" is not a name in sources.csv`,
          hint: "add it to sources.csv, or check for a typo",
          severity: "warning",
        });
      }
    }
  }

  // exposure.occupation / code should match a row in occupations.csv, when present.
  if (input.exposure && input.occupations) {
    const byTitle = new Set(input.occupations.map((row) => row.titleEn));
    const byCode = new Set(
      input.occupations.flatMap((row) => [row.id, row.escoUri, row.iscoCode].filter((v): v is string => !!v))
    );
    for (const row of input.exposure) {
      const occupationKnown = byTitle.has(row.occupation);
      const codeKnown = byCode.has(row.code);
      if (!occupationKnown && !codeKnown) {
        issues.push({
          file: "exposure.csv",
          row: row.row,
          column: "occupation",
          value: row.occupation,
          message: `"${row.occupation}" (code "${row.code}") does not match any row in occupations.csv`,
          hint: "check occupations.csv for a matching title_en, id, esco_uri, or isco_code",
          severity: "warning",
        });
      }
    }
  }

  return issues;
}
