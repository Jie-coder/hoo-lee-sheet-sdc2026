import { describe, expect, it } from "vitest";
import {
  mapCourseRow,
  mapExposureRow,
  mapKeywordRow,
  mapOccupationRow,
  mapProgrammeRow,
  mapSourceRow,
} from "./mappers";

const VALID_COURSE_ROW = {
  id: "c001",
  title: "Intro to Data Analysis",
  provider: "Contoso Learning",
  url: "https://example.com/courses/data-analysis",
  languages: "en,ms",
  hours: "20",
  cost_type: "free",
  certificate: "yes",
  skills: "Data analysis; Communication",
  skill_uris:
    "https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000001;https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000002",
  sdg_target: "4.4",
  sdg_reason: "Builds a transferable digital skill.",
  summary: "Hands-on spreadsheet analysis course.",
  last_checked: "2026-10-01",
  notes: "",
  mode: "online",
};

describe("mapCourseRow", () => {
  it("maps a valid row into the camelCase Course shape", () => {
    const result = mapCourseRow(VALID_COURSE_ROW, 2);
    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({
      id: "c001",
      title: "Intro to Data Analysis",
      languages: ["en", "ms"],
      hours: 20,
      costType: "free",
      certificate: true,
      skillIds: [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ],
      lastChecked: "2026-10-01",
      mode: "online",
    });
  });

  it("normalises mode and reports a bad or blank mode against the mode column", () => {
    expect(mapCourseRow({ ...VALID_COURSE_ROW, mode: " Physical " }, 2).value?.mode).toBe("physical");

    for (const mode of ["", "in-person"]) {
      const result = mapCourseRow({ ...VALID_COURSE_ROW, mode }, 5);
      expect(result.value).toBeNull();
      const issue = result.issues.find((i) => i.column === "mode");
      expect(issue).toMatchObject({ row: 5, column: "mode", value: mode, severity: "error" });
      expect(issue?.hint).toContain("hybrid");
    }
  });

  it("reports a bad cost_type against the cost_type column with the row number", () => {
    const result = mapCourseRow({ ...VALID_COURSE_ROW, cost_type: "freemium" }, 7);
    expect(result.value).toBeNull();
    const issue = result.issues.find((i) => i.column === "cost_type");
    expect(issue).toMatchObject({
      file: "courses.csv",
      row: 7,
      column: "cost_type",
      value: "freemium",
      severity: "error",
    });
    expect(issue?.hint).toContain("free");
  });

  it("flags a skills/skill_uris count mismatch against the skills column", () => {
    const result = mapCourseRow(
      { ...VALID_COURSE_ROW, skills: "Data analysis; Communication; Teamwork" },
      3
    );
    const issue = result.issues.find((i) => i.column === "skills");
    expect(issue).toMatchObject({ row: 3, column: "skills" });
    expect(result.value).toBeNull();
  });

  it("flags a malformed ESCO URI", () => {
    const result = mapCourseRow({ ...VALID_COURSE_ROW, skill_uris: "https://example.com/not-esco" }, 4);
    const issue = result.issues.find((i) => i.column === "skill_uris");
    expect(issue?.message).toContain("does not look like an ESCO concept URI");
  });
});

const VALID_PROGRAMME_ROW = {
  id: "p001",
  name: "Reskilling Grant",
  agency: "Contoso Workforce Agency",
  url: "https://example.com/programmes/reskilling-grant",
  benefits: "Covers course fees.",
  cost_type: "subsidised",
  deadline: "",
  age_min: "18",
  age_max: "",
  citizen: "yes",
  employment: "any",
  perkeso_contributor: "",
  states: "all",
  last_checked: "2026-10-01",
  notes: "",
};

describe("mapProgrammeRow", () => {
  it("maps blanks to null and builds snake_case eligibility", () => {
    const result = mapProgrammeRow(VALID_PROGRAMME_ROW, 2);
    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({
      deadline: null,
      eligibility: {
        age_min: 18,
        age_max: null,
        citizen: true,
        employment: ["any"],
        perkeso_contributor: null,
        states: ["all"],
      },
    });
  });

  it("rejects 'any' combined with another employment status, on the employment column", () => {
    const result = mapProgrammeRow({ ...VALID_PROGRAMME_ROW, employment: "any,employed" }, 5);
    const issue = result.issues.find((i) => i.column === "employment");
    expect(issue).toMatchObject({ row: 5, column: "employment" });
    expect(result.value).toBeNull();
  });

  it("rejects 'all' combined with a specific state, on the states column", () => {
    const result = mapProgrammeRow({ ...VALID_PROGRAMME_ROW, states: "all,johor" }, 6);
    const issue = result.issues.find((i) => i.column === "states");
    expect(issue).toMatchObject({ row: 6, column: "states" });
  });
});

describe("mapSourceRow", () => {
  const valid = {
    name: "Contoso AI Exposure Index",
    url: "https://example.com/data/ai-exposure-index",
    publisher: "Contoso Labs",
    what_it_measures: "Occupation-level AI exposure score",
    update_frequency: "annual",
    last_updated: "2026-09-01",
    data_format: "CSV",
    licence: "CC-BY-4.0",
    use_for: "exposure",
    notes: "",
  };

  it("maps a valid row", () => {
    const result = mapSourceRow(valid, 2);
    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({ dataFormat: "CSV", useFor: "exposure" });
  });

  it("requires a non-blank licence", () => {
    const result = mapSourceRow({ ...valid, licence: "" }, 3);
    const issue = result.issues.find((i) => i.column === "licence");
    expect(issue).toMatchObject({ row: 3, column: "licence" });
  });
});

describe("mapKeywordRow", () => {
  const valid = {
    keyword: "retrieval augmented generation",
    arxiv_query: "cat:cs.CL AND abs:rag",
    skills: "Data analysis",
    skill_uris: "https://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000001",
    direction: "up",
    count_last_90d: "145",
    count_prev_90d: "98",
    checked_on: "2026-10-10",
  };

  it("maps a valid row", () => {
    const result = mapKeywordRow(valid, 2);
    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({ direction: "up", countLast90d: 145 });
  });

  it("warns (not errors) when both windows are under the 20-papers threshold", () => {
    const result = mapKeywordRow({ ...valid, count_last_90d: "5", count_prev_90d: "4", direction: "up" }, 3);
    expect(result.value).not.toBeNull();
    expect(result.issues).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ severity: "warning", row: 3, column: "count_last_90d" });
  });
});

describe("mapExposureRow", () => {
  const valid = {
    occupation: "Data Analyst",
    code: "2512",
    exposure_value: "0.62",
    scale: "0-1",
    source_name: "Contoso AI Exposure Index",
    source_url: "https://example.com/data/ai-exposure-index",
    table_or_page: "Table 3",
    as_of: "2026-09-01",
    notes: "",
  };

  it("maps a valid row", () => {
    const result = mapExposureRow(valid, 2);
    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({ exposureValue: 0.62 });
  });

  it("rejects a malformed date on the as_of column", () => {
    const result = mapExposureRow({ ...valid, as_of: "2026/09/01" }, 4);
    const issue = result.issues.find((i) => i.column === "as_of");
    expect(issue).toMatchObject({ row: 4, column: "as_of" });
  });
});

describe("mapOccupationRow", () => {
  const valid = {
    id: "o001",
    esco_uri: "https://data.europa.eu/esco/occupation/00000000-0000-0000-0000-000000000101",
    isco_code: "2512",
    title_en: "Data Analyst",
    title_ms: "Penganalisis Data",
    description: "Analyses data sets.",
    cluster: "data_analytics",
    is_emerging: "no",
    last_checked: "2026-10-01",
    notes: "",
  };

  it("maps a valid row", () => {
    const result = mapOccupationRow(valid, 2);
    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({ cluster: "data_analytics", isEmerging: false });
  });

  it("rejects a cluster outside CLUSTER_IDS", () => {
    const result = mapOccupationRow({ ...valid, cluster: "robotics" }, 5);
    const issue = result.issues.find((i) => i.column === "cluster");
    expect(issue).toMatchObject({ row: 5, column: "cluster" });
    expect(issue?.hint).toContain("ai_digital");
  });
});
