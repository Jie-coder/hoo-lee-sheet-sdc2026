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
  DemandRowSchema,
  ExposureRowSchema,
  KeywordRowSchema,
  OccupationRowSchema,
  OccupationSkillRowSchema,
  ScenarioRowSchema,
  SIGNAL_DIRECTIONS,
  SkillGroupSdgRowSchema,
  SourceRowSchema,
  type DemandRow,
  type ExposureRow,
  type KeywordRow,
  type OccupationRow,
  type OccupationSkillRow,
  type ScenarioRow,
  type SkillGroupSdgRow,
  type SourceRow,
} from "./row-schemas";
import {
  isCustomSkillId,
  skillRefToId,
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
import { FLAT_BAND, hasEnoughPapers, MIN_PAPERS, signalDirection } from "./arxiv";

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

/** Course skills may also be Laluan custom skills ("laluan:<slug>"), defined in custom_skills.csv. */
function checkCourseSkillRefs(file: string, row: number, column: string, refs: string[]): Issue[] {
  return checkEscoUris(file, row, column, refs.filter((ref) => !isCustomSkillId(ref)));
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

/** Maps one courses.csv row. skills/skill_uris and summary are editorial: not part of CourseSchema, but checked here. */
export function mapCourseRow(raw: Record<string, string>, row: number): CourseRowResult {
  const file = "courses.csv";
  const issues: Issue[] = [];

  const languages = splitCodes(raw.languages ?? "");
  const skills = splitNames(raw.skills ?? "");
  const skillUris = splitNames(raw.skill_uris ?? "");
  issues.push(...requireSameLength(file, row, "skills", skills, "skill_uris", skillUris));
  issues.push(...checkCourseSkillRefs(file, row, "skill_uris", skillUris));

  const hours = parseNumber(raw.hours ?? "");
  if (!hours.ok) {
    issues.push(
      cellIssue(file, row, "hours", raw.hours ?? "", hours.error, "enter the course length in hours as a plain number, e.g. 12")
    );
  }

  const certificate = parseYesNo(raw.certificate ?? "");
  if (!certificate.ok) {
    issues.push(
      cellIssue(file, row, "certificate", raw.certificate ?? "", certificate.error, 'use "yes" or "no"')
    );
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
    skillIds: skillUris.map(skillRefToId),
    sdgTarget: raw.sdg_target ?? "",
    sdgReason: raw.sdg_reason ?? "",
    lastChecked: raw.last_checked ?? "",
    mode: (raw.mode ?? "").trim().toLowerCase(),
    aiContent: (raw.ai_content ?? "").trim().toLowerCase(),
  };

  const parsed = CourseSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: { skillIds: "skills", sdgTarget: "sdg_target", sdgReason: "sdg_reason" },
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
  if (!ageMin.ok) {
    issues.push(cellIssue(file, row, "age_min", raw.age_min ?? "", ageMin.error, "enter a whole number, or leave blank"));
  }
  const ageMax = parseIntOrBlank(raw.age_max ?? "");
  if (!ageMax.ok) {
    issues.push(cellIssue(file, row, "age_max", raw.age_max ?? "", ageMax.error, "enter a whole number, or leave blank"));
  }

  const citizen = parseYesNoOrBlank(raw.citizen ?? "");
  if (!citizen.ok) {
    issues.push(
      cellIssue(file, row, "citizen", raw.citizen ?? "", citizen.error, 'use "yes", "no", or leave blank')
    );
  }

  const perkesoContributor = parseYesNoOrBlank(raw.perkeso_contributor ?? "");
  if (!perkesoContributor.ok) {
    issues.push(
      cellIssue(
        file,
        row,
        "perkeso_contributor",
        raw.perkeso_contributor ?? "",
        perkesoContributor.error,
        'use "yes", "no", or leave blank'
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
        !countLast90d.ok ? countLast90d.error : "count_last_90d is required",
        "enter a whole number (0 or more)"
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
        !countPrev90d.ok ? countPrev90d.error : "count_prev_90d is required",
        "enter a whole number (0 or more)"
      )
    );
  }

  // A keyword that falls from 30 papers to 5 is a real decline, so only warn
  // when both windows are small: then scoring ignores it (hasEnoughPapers).
  if (
    countLast90d.ok &&
    countLast90d.value !== null &&
    countPrev90d.ok &&
    countPrev90d.value !== null &&
    !hasEnoughPapers(countLast90d.value, countPrev90d.value)
  ) {
    warnings.push(
      warnIssue(
        file,
        row,
        "count_last_90d",
        raw.count_last_90d,
        `fewer than ${MIN_PAPERS} papers in both 90-day windows, so scoring ignores this keyword`,
        "use a broader arxiv_query, or drop the keyword (data/README.md)"
      )
    );
  }

  if (
    countLast90d.ok &&
    countLast90d.value !== null &&
    countPrev90d.ok &&
    countPrev90d.value !== null &&
    (SIGNAL_DIRECTIONS as readonly string[]).includes(raw.direction ?? "")
  ) {
    const expected = signalDirection(countLast90d.value, countPrev90d.value);
    if (raw.direction !== expected) {
      warnings.push(
        warnIssue(
          file,
          row,
          "direction",
          raw.direction,
          `direction is "${raw.direction}" but ${countLast90d.value} vs ${countPrev90d.value} papers is "${expected}" (±${FLAT_BAND * 100}% is flat)`,
          "rerun npx tsx scripts/fetch-arxiv.ts, which sets direction from the counts"
        )
      );
    }
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
    notes: raw.notes ?? "",
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
    issues.push(
      cellIssue(
        file,
        row,
        "exposure_value",
        raw.exposure_value ?? "",
        exposureValue.error,
        "copy the number as published, e.g. 0.62"
      )
    );
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

export function mapOccupationSkillRow(
  raw: Record<string, string>,
  row: number
): MapResult<OccupationSkillRow> {
  const file = "occupation_skills.csv";
  const issues: Issue[] = [];

  const skillUri = raw.skill_uri ?? "";
  if (!isBlank(skillUri) && !(isEscoUri(skillUri) && skillUri.includes("/esco/skill/"))) {
    issues.push(
      cellIssue(
        file,
        row,
        "skill_uri",
        skillUri,
        "not an ESCO skill URI",
        "regenerate this file with scripts/fetch-esco-skills.ts"
      )
    );
  }

  const candidate = {
    occupationId: raw.occupation_id ?? "",
    skillUri: skillUri.trim(),
    skillLabel: raw.skill_label ?? "",
    relation: raw.relation ?? "",
    sourceName: raw.source_name ?? "",
    asOf: raw.as_of ?? "",
  };
  const parsed = OccupationSkillRowSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(
      ...zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: {
          occupationId: "occupation_id",
          skillUri: "skill_uri",
          skillLabel: "skill_label",
          sourceName: "source_name",
          asOf: "as_of",
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
    issues.push(
      cellIssue(file, row, "is_emerging", raw.is_emerging ?? "", isEmerging.error, 'use "yes" or "no"')
    );
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
    const zodIssues = zodErrorToIssues(parsed.error, {
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
    });
    // The manual ESCO-format check above already reported this cell with a
    // more specific hint; drop zod's generic "Invalid URL" for the same cell.
    const hasManualEscoUriIssue = issues.some((issue) => issue.column === "esco_uri");
    issues.push(...zodIssues.filter((issue) => !(hasManualEscoUriIssue && issue.column === "esco_uri")));
  }

  return { issues, value: issues.length === 0 && parsed.success ? parsed.data : null };
}

/**
 * Reads one required number cell. Returns NaN (and an issue) when the cell is
 * not a plain number, so the zod check below reports nothing extra for it.
 */
function numberCell(
  file: string,
  row: number,
  raw: Record<string, string>,
  column: string,
  hint: string,
  issues: Issue[]
): number {
  const parsed = parseNumber(raw[column] ?? "");
  if (parsed.ok) return parsed.value;
  issues.push(cellIssue(file, row, column, raw[column] ?? "", parsed.error, hint));
  return Number.NaN;
}

/** Maps one demand.csv row (written by scripts/fetch-dosm-demand.ts). */
export function mapDemandRow(raw: Record<string, string>, row: number): MapResult<DemandRow> {
  const file = "demand.csv";
  const issues: Issue[] = [];
  const hint = "regenerate this file with scripts/fetch-dosm-demand.ts";
  const value = numberCell(file, row, raw, "value", hint, issues);
  const prevValue = numberCell(file, row, raw, "prev_value", hint, issues);

  const candidate = {
    cluster: (raw.cluster ?? "").trim(),
    iscoMajorGroup: (raw.isco_major_group ?? "").trim(),
    metric: raw.metric ?? "",
    value,
    period: (raw.period ?? "").trim(),
    prevValue,
    prevPeriod: (raw.prev_period ?? "").trim(),
    sourceName: raw.source_name ?? "",
    sourceUrl: raw.source_url ?? "",
    tableOrDataset: raw.table_or_dataset ?? "",
    asOf: raw.as_of ?? "",
    notes: raw.notes ?? "",
  };

  const parsed = DemandRowSchema.safeParse(candidate);
  if (!parsed.success) {
    const zodIssues = zodErrorToIssues(parsed.error, {
      file,
      row,
      raw,
      columnOverrides: {
        iscoMajorGroup: "isco_major_group",
        prevValue: "prev_value",
        prevPeriod: "prev_period",
        sourceName: "source_name",
        sourceUrl: "source_url",
        tableOrDataset: "table_or_dataset",
        asOf: "as_of",
      },
    });
    // A cell that already failed the number check would also fail zod (NaN).
    const reported = new Set(issues.map((issue) => issue.column));
    issues.push(...zodIssues.filter((issue) => !reported.has(issue.column)));
  }

  // The later period must come after the earlier one, or the growth is backwards.
  if (parsed.success && parsed.data.prevPeriod >= parsed.data.period) {
    issues.push(
      cellIssue(
        file,
        row,
        "prev_period",
        raw.prev_period ?? "",
        `prev_period "${parsed.data.prevPeriod}" is not before period "${parsed.data.period}"`,
        hint
      )
    );
  }

  return { issues, value: issues.length === 0 && parsed.success ? parsed.data : null };
}

/** Maps one scenarios.csv row: one cited demand multiplier for one scenario and cluster. */
export function mapScenarioRow(raw: Record<string, string>, row: number): MapResult<ScenarioRow> {
  const file = "scenarios.csv";
  const issues: Issue[] = [];
  const demandMultiplier = numberCell(
    file,
    row,
    raw,
    "demand_multiplier",
    "enter 1 + net growth / 100, e.g. 1.41 for +41%",
    issues
  );
  const theta = numberCell(file, row, raw, "theta", "enter the exposure penalty, e.g. 1.4", issues);

  const candidate = {
    scenarioId: (raw.scenario_id ?? "").trim(),
    cluster: (raw.cluster ?? "").trim(),
    demandMultiplier,
    theta,
    sourceName: raw.source_name ?? "",
    sourceUrl: raw.source_url ?? "",
    pageOrFigure: raw.page_or_figure ?? "",
    quoteOrFigure: raw.quote_or_figure ?? "",
    asOf: raw.as_of ?? "",
    notes: raw.notes ?? "",
  };

  const parsed = ScenarioRowSchema.safeParse(candidate);
  if (!parsed.success) {
    const zodIssues = zodErrorToIssues(parsed.error, {
      file,
      row,
      raw,
      columnOverrides: {
        scenarioId: "scenario_id",
        demandMultiplier: "demand_multiplier",
        sourceName: "source_name",
        sourceUrl: "source_url",
        pageOrFigure: "page_or_figure",
        quoteOrFigure: "quote_or_figure",
        asOf: "as_of",
      },
    });
    const reported = new Set(issues.map((issue) => issue.column));
    issues.push(...zodIssues.filter((issue) => !reported.has(issue.column)));
  }

  return { issues, value: issues.length === 0 && parsed.success ? parsed.data : null };
}

/** Maps one skill_group_sdg.csv row: one SDG target per ESCO skill group. */
export function mapSkillGroupSdgRow(raw: Record<string, string>, row: number): MapResult<SkillGroupSdgRow> {
  const file = "skill_group_sdg.csv";
  const candidate = {
    groupUri: (raw.group_uri ?? "").trim(),
    groupLabel: raw.group_label ?? "",
    sdgTarget: (raw.sdg_target ?? "").trim(),
    sdgReason: raw.sdg_reason ?? "",
    checkedOn: (raw.checked_on ?? "").trim(),
  };
  const parsed = SkillGroupSdgRowSchema.safeParse(candidate);
  const issues = parsed.success
    ? []
    : zodErrorToIssues(parsed.error, {
        file,
        row,
        raw,
        columnOverrides: {
          groupUri: "group_uri",
          groupLabel: "group_label",
          sdgTarget: "sdg_target",
          sdgReason: "sdg_reason",
          checkedOn: "checked_on",
        },
      });
  return { issues, value: parsed.success ? parsed.data : null };
}
