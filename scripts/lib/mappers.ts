// Maps one CSV row (snake_case cells, all strings) into the matching
// camelCase contract or row schema, collecting report Issues along the way.
// Every mapper also returns the lists needed for cross-file checks (skills,
// skill URIs, ids) so the caller does not have to re-parse the raw row.
import {
  CourseSchema,
  ProgrammeSchema,
  type Course,
  type Programme,
} from "../../src/types/contracts";
import {
  ExposureRowSchema,
  KeywordRowSchema,
  OccupationRowSchema,
  SourceRowSchema,
  type ExposureRow,
  type KeywordRow,
  type OccupationRow,
  type SourceRow,
} from "./row-schemas";
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
import type { Issue } from "./report";
import { zodErrorToIssues } from "./zod-report";

export type MapResult<T> = {
  issues: Issue[];
  value: T | null;
};

function cellIssue(
  file: string,
  row: number,
  column: string,
  value: string,
  message: string,
  hint?: string
): Issue {
  return { file, row, column, value, message, hint, severity: "error" };
}

function warnIssue(
  file: string,
  row: number,
  column: string | undefined,
  value: string | undefined,
  message: string,
  hint?: string
): Issue {
  return { file, row, column, value, message, hint, severity: "warning" };
}

function requireSameLength(
  file: string,
  row: number,
  namesColumn: string,
  names: string[],
  urisColumn: string,
  uris: string[]
): Issue[] {
  if (names.length === uris.length) return [];
  return [
    cellIssue(
      file,
      row,
      namesColumn,
      names.join("; "),
      `"${namesColumn}" has ${names.length} item(s) but "${urisColumn}" has ${uris.length}`,
      `list the same number of items in "${namesColumn}" and "${urisColumn}", in the same order`
    ),
  ];
}

function checkEscoUris(file: string, row: number, column: string, uris: string[]): Issue[] {
  return uris
    .filter((uri) => !isEscoUri(uri))
    .map((uri) =>
      cellIssue(
        file,
        row,
        column,
        uri,
        `"${uri}" does not look like an ESCO concept URI`,
        "expected https://data.europa.eu/esco/skill/<uuid> or .../occupation/<uuid>"
      )
    );
}

export type CourseRowResult = MapResult<Course> & {
  skills: string[];
  skillUris: string[];
};

/** Maps one courses.csv row. skills/skill_uris, sdg_target/sdg_reason/summary are editorial: not part of CourseSchema, but checked here. */
export function mapCourseRow(raw: Record<string, string>, row: number): CourseRowResult {
  const file = "courses.csv";
  const issues: Issue[] = [];

  const languages = splitCodes(raw.languages ?? "");
  const skills = splitNames(raw.skills ?? "");
  const skillUris = splitNames(raw.skill_uris ?? "");
  issues.push(...requireSameLength(file, row, "skills", skills, "skill_uris", skillUris));
  issues.push(...checkEscoUris(file, row, "skill_uris", skillUris));

  const hours = parseNumber(raw.hours ?? "");
  if (!hours.ok) issues.push(cellIssue(file, row, "hours", raw.hours ?? "", hours.error));

  const certificate = parseYesNo(raw.certificate ?? "");
  if (!certificate.ok) {
    issues.push(cellIssue(file, row, "certificate", raw.certificate ?? "", certificate.error));
  }

  if (isBlank(raw.sdg_reason)) {
    issues.push(cellIssue(file, row, "sdg_reason", raw.sdg_reason ?? "", "sdg_reason is required"));
  }
  if (isBlank(raw.summary)) {
    issues.push(cellIssue(file, row, "summary", raw.summary ?? "", "summary is required"));
  }

  const candidate = {
    id: raw.id ?? "",
    title: raw.title ?? "",
    provider: raw.provider ?? "",
    url: raw.url ?? "",
    languages,
    hours: hours.ok ? hours.value : 0,
    costType: raw.cost_type ?? "",
    certificate: certificate.ok ? certificate.value : false,
    skillIds: skillUris.map(escoUriToId),
    lastChecked: raw.last_checked ?? "",
  };

  const parsed = CourseSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: { skillIds: "skills" },
      })
    );
  }

  return {
    issues,
    value: issues.length === 0 && parsed.success ? parsed.data : null,
    skills,
    skillUris,
  };
}

/** Maps one programmes.csv row into ProgrammeSchema, including eligibility. */
export function mapProgrammeRow(raw: Record<string, string>, row: number): MapResult<Programme> {
  const file = "programmes.csv";
  const issues: Issue[] = [];

  const ageMin = parseIntOrBlank(raw.age_min ?? "");
  if (!ageMin.ok) issues.push(cellIssue(file, row, "age_min", raw.age_min ?? "", ageMin.error));
  const ageMax = parseIntOrBlank(raw.age_max ?? "");
  if (!ageMax.ok) issues.push(cellIssue(file, row, "age_max", raw.age_max ?? "", ageMax.error));

  const citizen = parseYesNoOrBlank(raw.citizen ?? "");
  if (!citizen.ok) issues.push(cellIssue(file, row, "citizen", raw.citizen ?? "", citizen.error));

  const perkesoContributor = parseYesNoOrBlank(raw.perkeso_contributor ?? "");
  if (!perkesoContributor.ok) {
    issues.push(
      cellIssue(
        file,
        row,
        "perkeso_contributor",
        raw.perkeso_contributor ?? "",
        perkesoContributor.error
      )
    );
  }

  const deadlineBlank = isBlank(raw.deadline);

  const candidate = {
    id: raw.id ?? "",
    name: raw.name ?? "",
    agency: raw.agency ?? "",
    url: raw.url ?? "",
    benefits: raw.benefits ?? "",
    eligibility: {
      age_min: ageMin.ok ? ageMin.value : null,
      age_max: ageMax.ok ? ageMax.value : null,
      citizen: citizen.ok ? citizen.value : null,
      employment: splitCodes(raw.employment ?? ""),
      perkeso_contributor: perkesoContributor.ok ? perkesoContributor.value : null,
      states: splitCodes(raw.states ?? ""),
    },
    costType: raw.cost_type ?? "",
    deadline: deadlineBlank ? null : raw.deadline ?? "",
    lastChecked: raw.last_checked ?? "",
  };

  const parsed = ProgrammeSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: {
          "eligibility.age_min": "age_min",
          "eligibility.age_max": "age_max",
          "eligibility.citizen": "citizen",
          "eligibility.employment": "employment",
          "eligibility.perkeso_contributor": "perkeso_contributor",
          "eligibility.states": "states",
          deadline: "deadline",
        },
      })
    );
  }

  return { issues, value: issues.length === 0 && parsed.success ? parsed.data : null };
}

export function mapSourceRow(raw: Record<string, string>, row: number): MapResult<SourceRow> {
  const file = "sources.csv";
  const candidate = {
    name: raw.name ?? "",
    url: raw.url ?? "",
    publisher: raw.publisher ?? "",
    whatItMeasures: raw.what_it_measures ?? "",
    updateFrequency: raw.update_frequency ?? "",
    lastUpdated: raw.last_updated ?? "",
    dataFormat: raw.data_format ?? "",
    licence: raw.licence ?? "",
    useFor: raw.use_for ?? "",
    notes: raw.notes ?? "",
  };
  const parsed = SourceRowSchema.safeParse(candidate);
  const issues = parsed.success
    ? []
    : zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: {
          whatItMeasures: "what_it_measures",
          updateFrequency: "update_frequency",
          lastUpdated: "last_updated",
          dataFormat: "data_format",
          useFor: "use_for",
        },
      });
  return { issues, value: parsed.success ? parsed.data : null };
}

export type KeywordRowResult = MapResult<KeywordRow> & {
  skills: string[];
  skillUris: string[];
  warnings: Issue[];
};

const MIN_PAPERS_90D = 20;

export function mapKeywordRow(raw: Record<string, string>, row: number): KeywordRowResult {
  const file = "keywords.csv";
  const issues: Issue[] = [];
  const warnings: Issue[] = [];

  const skills = splitNames(raw.skills ?? "");
  const skillUris = splitNames(raw.skill_uris ?? "");
  issues.push(...requireSameLength(file, row, "skills", skills, "skill_uris", skillUris));
  issues.push(...checkEscoUris(file, row, "skill_uris", skillUris));

  const countLast90d = parseIntOrBlank(raw.count_last_90d ?? "");
  if (!countLast90d.ok || countLast90d.value === null) {
    issues.push(
      cellIssue(
        file,
        row,
        "count_last_90d",
        raw.count_last_90d ?? "",
        !countLast90d.ok ? countLast90d.error : "count_last_90d is required"
      )
    );
  }
  const countPrev90d = parseIntOrBlank(raw.count_prev_90d ?? "");
  if (!countPrev90d.ok || countPrev90d.value === null) {
    issues.push(
      cellIssue(
        file,
        row,
        "count_prev_90d",
        raw.count_prev_90d ?? "",
        !countPrev90d.ok ? countPrev90d.error : "count_prev_90d is required"
      )
    );
  }

  if (countLast90d.ok && countLast90d.value !== null && countLast90d.value < MIN_PAPERS_90D) {
    warnings.push(
      warnIssue(
        file,
        row,
        "count_last_90d",
        raw.count_last_90d,
        `fewer than ${MIN_PAPERS_90D} papers in the last 90 days`,
        "data/README.md says to drop keywords below this threshold"
      )
    );
  }

  const candidate = {
    keyword: raw.keyword ?? "",
    arxivQuery: raw.arxiv_query ?? "",
    skills,
    skillUris,
    direction: raw.direction ?? "",
    countLast90d: countLast90d.ok && countLast90d.value !== null ? countLast90d.value : 0,
    countPrev90d: countPrev90d.ok && countPrev90d.value !== null ? countPrev90d.value : 0,
    checkedOn: raw.checked_on ?? "",
  };

  const parsed = KeywordRowSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: { arxivQuery: "arxiv_query", checkedOn: "checked_on" },
      })
    );
  }

  return {
    issues,
    warnings,
    value: issues.length === 0 && parsed.success ? parsed.data : null,
    skills,
    skillUris,
  };
}

export function mapExposureRow(raw: Record<string, string>, row: number): MapResult<ExposureRow> {
  const file = "exposure.csv";
  const candidate = {
    occupation: raw.occupation ?? "",
    code: raw.code ?? "",
    exposureValue: Number.NaN,
    scale: raw.scale ?? "",
    sourceName: raw.source_name ?? "",
    sourceUrl: raw.source_url ?? "",
    tableOrPage: raw.table_or_page ?? "",
    asOf: raw.as_of ?? "",
    notes: raw.notes ?? "",
  };

  const issues: Issue[] = [];
  const exposureValue = parseNumber(raw.exposure_value ?? "");
  if (!exposureValue.ok) {
    issues.push(cellIssue(file, row, "exposure_value", raw.exposure_value ?? "", exposureValue.error));
  } else {
    candidate.exposureValue = exposureValue.value;
  }

  const parsed = ExposureRowSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: {
          sourceName: "source_name",
          sourceUrl: "source_url",
          tableOrPage: "table_or_page",
          asOf: "as_of",
          exposureValue: "exposure_value",
        },
      })
    );
  }

  return { issues, value: issues.length === 0 && parsed.success ? parsed.data : null };
}

export function mapOccupationRow(raw: Record<string, string>, row: number): MapResult<OccupationRow> {
  const file = "occupations.csv";
  const escoUriBlank = isBlank(raw.esco_uri);
  const iscoCodeBlank = isBlank(raw.isco_code);

  const issues: Issue[] = [];
  if (!escoUriBlank && !isEscoUri(raw.esco_uri ?? "")) {
    issues.push(
      cellIssue(
        file,
        row,
        "esco_uri",
        raw.esco_uri ?? "",
        `"${raw.esco_uri}" does not look like an ESCO concept URI`,
        "expected https://data.europa.eu/esco/occupation/<uuid>, or leave blank"
      )
    );
  }

  const isEmerging = parseYesNo(raw.is_emerging ?? "");
  if (!isEmerging.ok) {
    issues.push(cellIssue(file, row, "is_emerging", raw.is_emerging ?? "", isEmerging.error));
  }

  const candidate = {
    id: raw.id ?? "",
    escoUri: escoUriBlank ? null : raw.esco_uri ?? "",
    iscoCode: iscoCodeBlank ? null : raw.isco_code ?? "",
    titleEn: raw.title_en ?? "",
    titleMs: raw.title_ms ?? "",
    description: raw.description ?? "",
    cluster: raw.cluster ?? "",
    isEmerging: isEmerging.ok ? isEmerging.value : false,
    lastChecked: raw.last_checked ?? "",
    notes: raw.notes ?? "",
  };

  const parsed = OccupationRowSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: {
          escoUri: "esco_uri",
          iscoCode: "isco_code",
          titleEn: "title_en",
          titleMs: "title_ms",
          isEmerging: "is_emerging",
          lastChecked: "last_checked",
        },
      })
    );
  }

  return { issues, value: issues.length === 0 && parsed.success ? parsed.data : null };
}
