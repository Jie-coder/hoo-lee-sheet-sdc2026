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

export type OccupationSkillCrossRow = { row: number; occupationId: string; sourceName: string };
export type DemandCrossRow = { row: number; cluster: string; iscoMajorGroup: string; sourceName: string };
export type ScenarioCrossRow = { row: number; scenarioId: string; cluster: string; sourceName: string };

export type CrossCheckInput = {
  courses?: CourseCrossRow[];
  sources?: SourceCrossRow[];
  keywords?: KeywordCrossRow[];
  exposure?: ExposureCrossRow[];
  occupations?: OccupationCrossRow[];
  occupationSkills?: OccupationSkillCrossRow[];
  /** cluster is the raw cell, so occupations needs its cluster too (see occupationClusters). */
  demand?: DemandCrossRow[];
  scenarios?: ScenarioCrossRow[];
  /** occupations.csv id -> cluster and isco_code, for the demand.csv checks. */
  occupationClusters?: { id: string; cluster: string; iscoCode: string | null }[];
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

/**
 * scenarios.csv: every row of one scenario must use the same theta, since
 * theta is one number per scenario (public.scenarios.theta). Within-file.
 */
export function scenarioThetaIssues(rows: { row: number; scenarioId: string; theta: number }[]): Issue[] {
  const firstTheta = new Map<string, { row: number; theta: number }>();
  const issues: Issue[] = [];
  for (const { row, scenarioId, theta } of rows) {
    const first = firstTheta.get(scenarioId);
    if (!first) {
      firstTheta.set(scenarioId, { row, theta });
      continue;
    }
    if (first.theta !== theta) {
      issues.push({
        file: "scenarios.csv",
        row,
        column: "theta",
        value: String(theta),
        message: `theta ${theta} differs from ${first.theta} on row ${first.row} for scenario "${scenarioId}"`,
        hint: "use one theta per scenario",
        severity: "error",
      });
    }
  }
  return issues;
}

/** Flags a source_name that is not a row in sources.csv: an error, since --apply would break its foreign key. */
function unknownSourceIssues(
  file: string,
  rows: { row: number; sourceName: string }[],
  sourceNames: Set<string>
): Issue[] {
  const reported = new Set<string>();
  const issues: Issue[] = [];
  for (const row of rows) {
    if (row.sourceName.length === 0 || sourceNames.has(row.sourceName) || reported.has(row.sourceName)) continue;
    reported.add(row.sourceName);
    issues.push({
      file,
      row: row.row,
      column: "source_name",
      value: row.sourceName,
      message: `"${row.sourceName}" is not a name in sources.csv`,
      hint: "add it to sources.csv (and the AI Signals sheet), or check for a typo",
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

  // occupation_skills.occupation_id must be an id in occupations.csv: it is a
  // foreign key, so --apply would reject the row. An error, not a warning.
  if (input.occupationSkills && input.occupations) {
    const occupationIds = new Set(input.occupations.map((row) => row.id));
    for (const row of input.occupationSkills) {
      if (row.occupationId.length > 0 && !occupationIds.has(row.occupationId)) {
        issues.push({
          file: "occupation_skills.csv",
          row: row.row,
          column: "occupation_id",
          value: row.occupationId,
          message: `"${row.occupationId}" is not an id in occupations.csv`,
          hint: "regenerate occupation_skills.csv with scripts/fetch-esco-skills.ts after changing occupations.csv",
          severity: "error",
        });
      }
    }
  }

  // occupation_skills.source_name should name a row in sources.csv.
  if (input.occupationSkills && input.sources) {
    const sourceNames = new Set(input.sources.map((row) => row.name));
    const reported = new Set<string>();
    for (const row of input.occupationSkills) {
      if (row.sourceName.length > 0 && !sourceNames.has(row.sourceName) && !reported.has(row.sourceName)) {
        reported.add(row.sourceName);
        issues.push({
          file: "occupation_skills.csv",
          row: row.row,
          column: "source_name",
          value: row.sourceName,
          message: `"${row.sourceName}" is not a name in sources.csv`,
          hint: "add it to sources.csv (use_for: skills), or check for a typo",
          severity: "warning",
        });
      }
    }
  }

  // demand.csv / scenarios.csv source_name must name a sources.csv row.
  if (input.sources) {
    const sourceNames = new Set(input.sources.map((row) => row.name));
    if (input.demand) issues.push(...unknownSourceIssues("demand.csv", input.demand, sourceNames));
    if (input.scenarios) issues.push(...unknownSourceIssues("scenarios.csv", input.scenarios, sourceNames));
  }

  if (input.occupationClusters) {
    const clustersInUse = new Set(input.occupationClusters.map((occupation) => occupation.cluster));
    // Major groups each cluster's occupations actually fall in (first ISCO digit).
    const groupsByCluster = new Map<string, Set<string>>();
    for (const occupation of input.occupationClusters) {
      if (!occupation.iscoCode) continue;
      const groups = groupsByCluster.get(occupation.cluster) ?? new Set<string>();
      groups.add(occupation.iscoCode.trim().charAt(0));
      groupsByCluster.set(occupation.cluster, groups);
    }

    if (input.demand) {
      for (const row of input.demand) {
        const groups = groupsByCluster.get(row.cluster);
        if (groups && !groups.has(row.iscoMajorGroup)) {
          issues.push({
            file: "demand.csv",
            row: row.row,
            column: "isco_major_group",
            value: row.iscoMajorGroup,
            message: `no ${row.cluster} occupation in occupations.csv has an ISCO code starting with ${row.iscoMajorGroup}`,
            hint: "regenerate demand.csv with scripts/fetch-dosm-demand.ts after changing occupations.csv",
            severity: "warning",
          });
        }
      }
      const covered = new Set(input.demand.map((row) => row.cluster));
      for (const cluster of clustersInUse) {
        if (!covered.has(cluster)) {
          issues.push({
            file: "demand.csv",
            column: "cluster",
            value: cluster,
            message: `cluster "${cluster}" is used in occupations.csv but has no demand.csv rows`,
            hint: "regenerate demand.csv with scripts/fetch-dosm-demand.ts",
            severity: "warning",
          });
        }
      }
    }

    if (input.scenarios) {
      const pairs = new Set(input.scenarios.map((row) => `${row.scenarioId} ${row.cluster}`));
      const scenarioIds = new Set(input.scenarios.map((row) => row.scenarioId));
      for (const scenarioId of scenarioIds) {
        for (const cluster of clustersInUse) {
          if (!pairs.has(`${scenarioId} ${cluster}`)) {
            issues.push({
              file: "scenarios.csv",
              column: "cluster",
              value: cluster,
              message: `scenario "${scenarioId}" has no row for cluster "${cluster}", which occupations.csv uses`,
              hint: "add one cited multiplier per scenario and cluster",
              severity: "warning",
            });
          }
        }
      }
    }
  }

  return issues;
}
