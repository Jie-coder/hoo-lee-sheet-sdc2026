import { describe, expect, it } from "vitest";

import {
  AnalyzeResponseSchema,
  CLUSTER_IDS,
  ClusterIdSchema,
  CostTypeSchema,
  CourseModeSchema,
  CourseSchema,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  GapSkillSchema,
  InterviewTurnSchema,
  LANGUAGE_CODES,
  LanguageCodeSchema,
  MAX_INTERVIEW_TURNS,
  ParsedCVSchema,
  PathwayPlanSchema,
  PlanStepSchema,
  ProgrammeEligibilitySchema,
  ProgrammeSchema,
  RoleResultSchema,
  ScenarioIdSchema,
  scoreBand,
  SdgLinkSchema,
  SignalReadingSchema,
  SignalSnapshotSchema,
  SlotsSchema,
  SourceSchema,
  type ParsedCV,
  type RoleResult,
  type Slots,
} from "./contracts";

const source = {
  dataset: "ILO GenAI exposure 2025",
  releaseDate: "2025-05-01",
  url: "https://www.ilo.org/publications/generative-ai-and-jobs",
  asOf: "2026-10-19",
};

const occupationSdg = {
  subject: { kind: "occupation" as const, occupationId: "data-operations-analyst" },
  target: "8.6",
  kind: "transition" as const,
  tier: "direct" as const,
  confidence: 1,
  reason: "Moving an underemployed young worker into this role advances target 8.6.",
  source,
};

const role: RoleResult = {
  occupationId: "data-operations-analyst",
  title: "Data operations analyst",
  fit: 0.62,
  exposure: 0.41,
  augmentation: 0.7,
  byScenario: { co: 0.71, dis: 0.48, sup: 0.8 },
  robust: true,
  gap: [{ skillId: "data-visualisation", label: "Data visualisation", importance: 0.84 }],
  sdg: [occupationSdg],
  sources: [source],
  signalsAsOf: "2026-10-19",
};

const slots: Slots = {
  tasks: [
    { text: "Data entry", share: 0.5 },
    { text: "Scheduling and email", share: 0.5 },
  ],
  tools: ["Excel", "WhatsApp"],
  ai_usage: "tried",
  hours_per_week: 6,
  budget: 0,
  languages: ["ms", "en"],
  age_band: "18-24",
  state: "pulau_pinang",
  employment_status: "underemployed",
  perkeso_contributor: true,
  impact_interest: "community",
};

const step = {
  itemId: "ai-untuk-rakyat",
  kind: "program" as const,
  weekStart: 1,
  weekEnd: 2,
  closesSkillIds: ["digital-literacy"],
  sdgTarget: "4.4",
  why: "Opens the free AI modules she is eligible for.",
};

describe("ParsedCV", () => {
  const cv: ParsedCV = {
    name: "Aisyah",
    roles: [{ title: "Admin clerk", years: 1.5, tasks: ["Data entry", "Filing"] }],
    skills: ["Excel"],
    education: [{ level: "Diploma", field: "Business" }],
    languages: ["Bahasa Melayu", "English"],
  };

  it("parses a CV", () => {
    expect(ParsedCVSchema.parse(cv)).toEqual(cv);
  });

  it("rejects a stored CV path", () => {
    expect(ParsedCVSchema.safeParse({ ...cv, cv_path: "cvs/aisyah.pdf" }).success).toBe(false);
  });
});

describe("Slots", () => {
  it("parses a complete slot set", () => {
    expect(SlotsSchema.parse(slots)).toEqual(slots);
  });

  it("rejects more hours than a week has", () => {
    expect(SlotsSchema.safeParse({ ...slots, hours_per_week: 200 }).success).toBe(false);
  });

  it("rejects an empty language list", () => {
    expect(SlotsSchema.safeParse({ ...slots, languages: [] }).success).toBe(false);
  });

  it("accepts Chinese as a study language", () => {
    expect(SlotsSchema.parse({ ...slots, languages: ["zh"] }).languages).toEqual(["zh"]);
  });
});

describe("LanguageCode", () => {
  it("is English, Malay, or Chinese", () => {
    expect(LANGUAGE_CODES).toEqual(["en", "ms", "zh"]);
    expect(LanguageCodeSchema.parse("zh")).toBe("zh");
  });

  it("rejects the removed both value", () => {
    expect(LanguageCodeSchema.safeParse("both").success).toBe(false);
  });
});

describe("MAX_INTERVIEW_TURNS", () => {
  it("stops after five questions", () => {
    expect(MAX_INTERVIEW_TURNS).toBe(5);
  });
});

describe("embeddings", () => {
  it("matches vector(768) and the Gemini model name", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
    expect(EMBEDDING_MODEL).toBe("gemini-embedding-001");
  });
});

describe("ClusterId", () => {
  it("parses the five scoring clusters", () => {
    expect(CLUSTER_IDS).toEqual([
      "ai_digital",
      "data_analytics",
      "green_sustainability",
      "human_care",
      "routine_clerical",
    ]);
    expect(ClusterIdSchema.parse("ai_digital")).toBe("ai_digital");
  });

  it("rejects a cluster not in the list", () => {
    expect(ClusterIdSchema.safeParse("retail").success).toBe(false);
  });
});

describe("InterviewTurn", () => {
  const turn = {
    question: "What share of your week is data entry?",
    chips: ["Under 25%", "25–50%", "50–75%", "Over 75%"],
    filled: { tools: ["Excel"], ai_usage: "tried" as const },
    done: false,
  };

  it("parses a turn with partial slots", () => {
    expect(InterviewTurnSchema.parse(turn)).toEqual(turn);
  });

  it("rejects a non-boolean done flag", () => {
    expect(InterviewTurnSchema.safeParse({ ...turn, done: "yes" }).success).toBe(false);
  });
});

describe("Source", () => {
  it("parses a source chip", () => {
    expect(SourceSchema.parse(source)).toEqual(source);
  });

  it("rejects a source with no link", () => {
    expect(SourceSchema.safeParse({ ...source, url: "not a url" }).success).toBe(false);
  });
});

describe("SdgLink", () => {
  it("parses an occupation link and a skill link", () => {
    expect(SdgLinkSchema.parse(occupationSdg)).toEqual(occupationSdg);
    const skillLink = {
      ...occupationSdg,
      subject: { kind: "skill" as const, skillId: "data-visualisation" },
      target: "4.4",
      kind: "role" as const,
    };
    expect(SdgLinkSchema.parse(skillLink).subject).toEqual({
      kind: "skill",
      skillId: "data-visualisation",
    });
  });

  it("rejects a goal-only label", () => {
    expect(SdgLinkSchema.safeParse({ ...occupationSdg, target: "SDG 8" }).success).toBe(false);
  });
});

describe("GapSkill", () => {
  it("parses a gap skill", () => {
    expect(GapSkillSchema.parse(role.gap[0])).toEqual(role.gap[0]);
  });

  it("rejects a negative importance", () => {
    expect(
      GapSkillSchema.safeParse({ ...role.gap[0], importance: -1 }).success,
    ).toBe(false);
  });
});

describe("ScenarioId", () => {
  it("parses the three scenario ids", () => {
    expect(ScenarioIdSchema.parse("co")).toBe("co");
    expect(ScenarioIdSchema.parse("dis")).toBe("dis");
    expect(ScenarioIdSchema.parse("sup")).toBe("sup");
  });

  it("rejects a full scenario name", () => {
    expect(ScenarioIdSchema.safeParse("co-pilot").success).toBe(false);
  });
});

describe("RoleResult", () => {
  it("parses a role card tied to a signal snapshot", () => {
    expect(RoleResultSchema.parse(role)).toMatchObject({ signalsAsOf: "2026-10-19" });
  });

  it("rejects a fit score above 1", () => {
    expect(RoleResultSchema.safeParse({ ...role, fit: 2 }).success).toBe(false);
  });

  it("rejects a role card whose SDG link is about a skill", () => {
    const skillOnRole = {
      ...role,
      sdg: [{ ...occupationSdg, subject: { kind: "skill" as const, skillId: "excel" } }],
    };
    expect(RoleResultSchema.safeParse(skillOnRole).success).toBe(false);
  });
});

describe("AnalyzeResponse", () => {
  const response = {
    signalsAsOf: "2026-10-19",
    currentWork: { exposure: 0.58, augmentation: 0.73, sources: [source] },
    roles: [role],
  };

  it("parses a response that names its signal snapshot", () => {
    expect(AnalyzeResponseSchema.parse(response).signalsAsOf).toBe("2026-10-19");
  });

  it("rejects a role scored from a different snapshot", () => {
    const drifted = {
      ...response,
      roles: [{ ...role, signalsAsOf: "2026-09-19" }],
    };
    expect(AnalyzeResponseSchema.safeParse(drifted).success).toBe(false);
  });
});

describe("CostType", () => {
  it("parses the brief's cost tags", () => {
    expect(CostTypeSchema.parse("hrdcorp_claimable")).toBe("hrdcorp_claimable");
  });

  it("rejects the American spelling of subsidised", () => {
    expect(CostTypeSchema.safeParse("subsidized").success).toBe(false);
  });
});

describe("ProgrammeEligibility", () => {
  const eligibility = {
    age_min: 18,
    age_max: 30,
    citizen: true,
    employment: ["any" as const],
    perkeso_contributor: null,
    states: ["all" as const],
  };

  it("parses the section 07 example", () => {
    expect(ProgrammeEligibilitySchema.parse(eligibility)).toEqual(eligibility);
  });

  it("rejects an age range that runs backwards", () => {
    expect(
      ProgrammeEligibilitySchema.safeParse({ ...eligibility, age_min: 40, age_max: 18 }).success,
    ).toBe(false);
  });
});

describe("PlanStep", () => {
  it("parses an ID-only step", () => {
    expect(PlanStepSchema.parse(step)).toEqual(step);
  });

  it("rejects a step that ends before it starts", () => {
    expect(PlanStepSchema.safeParse({ ...step, weekStart: 4, weekEnd: 1 }).success).toBe(false);
  });
});

describe("SignalSnapshot", () => {
  const today = {
    asOf: "2026-10-19",
    signals: [
      {
        skillId: "spreadsheets",
        source: "arXiv",
        metric: "momentum",
        value: 0.12,
        windowStart: "2026-07-22",
        windowEnd: "2026-10-19",
        url: "https://export.arxiv.org/api/query?search_query=spreadsheet",
      },
    ],
  };

  it("parses a snapshot dated asOf", () => {
    expect(SignalSnapshotSchema.parse(today).asOf).toBe("2026-10-19");
  });

  it("rejects a prose date", () => {
    expect(SignalSnapshotSchema.safeParse({ ...today, asOf: "today" }).success).toBe(false);
  });
});

describe("SignalReading source", () => {
  const reading = {
    skillId: "spreadsheets",
    source: "arXiv",
    metric: "momentum",
    value: 0.12,
    windowStart: "2026-07-22",
    windowEnd: "2026-10-19",
    url: "https://export.arxiv.org/api/query?search_query=spreadsheet",
  };

  it("accepts arXiv", () => {
    expect(SignalReadingSchema.parse(reading).source).toBe("arXiv");
  });

  it.each(["github", "ARXIV", ""])("rejects %j", (source) => {
    expect(SignalReadingSchema.safeParse({ ...reading, source }).success).toBe(false);
  });
});

describe("catalogue and pathway", () => {
  it("accepts only online, physical, or hybrid as a course mode", () => {
    expect(CourseModeSchema.options).toEqual(["online", "physical", "hybrid"]);
    expect(CourseModeSchema.safeParse("physical").success).toBe(true);
    expect(CourseModeSchema.safeParse("in-person").success).toBe(false);
  });

  it("parses a course, a programme, and a plan", () => {
    expect(
      CourseSchema.parse({
        id: "elatih-excel",
        title: "Excel for operations",
        provider: "HRD Corp e-LATiH",
        url: "https://elatih.hrdcorp.gov.my/course/excel",
        languages: ["en", "ms"],
        hours: 4,
        costType: "free",
        certificate: false,
        skillIds: ["spreadsheets"],
        lastChecked: "2026-10-01",
        mode: "online",
      }).costType,
    ).toBe("free");

    expect(
      CourseSchema.safeParse({
        id: "elatih-excel",
        title: "Excel for operations",
        provider: "HRD Corp e-LATiH",
        url: "https://elatih.hrdcorp.gov.my/course/excel",
        language: "en",
        hours: 4,
        costType: "free",
        certificate: false,
        skillIds: ["spreadsheets"],
        lastChecked: "2026-10-01",
        mode: "online",
      }).success,
    ).toBe(false);

    expect(
      CourseSchema.safeParse({
        id: "zh-course",
        title: "Excel",
        provider: "HRD Corp e-LATiH",
        url: "https://elatih.hrdcorp.gov.my/course/excel",
        languages: [],
        hours: 4,
        costType: "free",
        certificate: false,
        skillIds: ["spreadsheets"],
        lastChecked: "2026-10-01",
        mode: "online",
      }).success,
    ).toBe(false);

    expect(
      ProgrammeSchema.parse({
        id: "ai-untuk-rakyat",
        name: "AI Untuk Rakyat",
        agency: "MyDIGITAL",
        url: "https://rakyatdigital.gov.my/",
        benefits: "Three months of AI software access after the modules.",
        eligibility: {
          age_min: 18,
          age_max: 30,
          citizen: true,
          employment: ["any"],
          perkeso_contributor: null,
          states: ["all"],
        },
        costType: "free",
        deadline: null,
        lastChecked: "2026-10-01",
      }).id,
    ).toBe("ai-untuk-rakyat");

    expect(
      PathwayPlanSchema.parse({
        occupationId: role.occupationId,
        steps: [step],
      }).steps,
    ).toHaveLength(1);
  });

  it("rejects a user id on a role card", () => {
    expect(RoleResultSchema.safeParse({ ...role, user_id: "user-1" }).success).toBe(false);
  });
});

describe("scoreBand", () => {
  it("keeps the section 05 boundaries in the medium band", () => {
    expect(scoreBand(0.32)).toBe("low");
    expect(scoreBand(0.33)).toBe("medium");
    expect(scoreBand(0.66)).toBe("medium");
    expect(scoreBand(0.67)).toBe("high");
  });
});
