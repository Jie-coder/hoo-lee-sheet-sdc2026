// Example results for the synthetic persona Aisyah. Not a measurement.
import {
  AnalyzeResponseSchema,
  SdgLinkSchema,
  type AnalyzeResponse,
  type GapSkill,
  type IsoDate,
  type RoleResult,
  type ScenarioScores,
  type SdgLink,
  type Source,
  type UnitScore,
} from "@/types/contracts";

/** Same two windows as the signal-date control. */
export type ExampleSignal = "today" | "thirty-days-ago";

type RoleStatus = { label: string; tone: "robust" | "shift" | "interest" };
type TaskAugmentation = { label: string; augmentation: UnitScore };

export const EXAMPLE_AS_OF: IsoDate = "2026-10-19";
export const EXAMPLE_PRIOR_AS_OF: IsoDate = "2026-09-19";

const DATA_OPS = "data-operations-analyst";
const CX = "customer-experience-specialist";
const ESG = "esg-reporting-associate";

export const AISYAH_TARGET_LABELS: Record<string, string> = {
  "4.4": "Skills for work",
  "5.5": "Women in leadership",
  "8.2": "Productivity",
  "8.5": "Decent work",
  "8.6": "Youth in work",
  "10.2": "Inclusion",
  "11.6": "Cities",
  "12.6": "Reporting",
  "13.3": "Climate awareness",
};

export const AISYAH_ROLE_STATUS: Record<string, RoleStatus> = {
  [DATA_OPS]: { label: "Robust in all 3 futures", tone: "robust" },
  [CX]: { label: "Drops to #3 in Displacement", tone: "shift" },
  [ESG]: { label: "Matches your interest: community", tone: "interest" },
};

const TASKS: TaskAugmentation[] = [
  { label: "Customer emails", augmentation: 0.84 },
  { label: "Filing reports", augmentation: 0.73 },
  { label: "Scheduling", augmentation: 0.66 },
  { label: "Data entry", augmentation: 0.58 },
];

export type ResultsExample = {
  /** This page is the synthetic demo persona, not a live score. */
  example: true;
  persona: {
    detail: string;
    headline: string;
    basis: string;
  };
  response: AnalyzeResponse;
  tasks: TaskAugmentation[];
  skillLinks: SdgLink[];
  targetLabels: Record<string, string>;
  roleStatus: Record<string, RoleStatus>;
};

const persona = {
  detail: "Aisyah, 23 · Admin clerk · Penang",
  headline: "AI can amplify most of your work",
  basis: "Based on your CV and 6 interview answers about how you spend your week.",
};

function source(dataset: string, releaseDate: IsoDate, url: string, asOf: IsoDate): Source {
  return { dataset, releaseDate, url, asOf };
}

function occupationLink(
  occupationId: string,
  target: string,
  kind: SdgLink["kind"],
  tier: SdgLink["tier"],
  confidence: UnitScore,
  reason: string,
  evidence: Source,
): SdgLink {
  return {
    subject: { kind: "occupation", occupationId },
    target,
    kind,
    tier,
    confidence,
    reason,
    source: evidence,
  };
}

function skillLink(
  skillId: string,
  target: string,
  tier: SdgLink["tier"],
  confidence: UnitScore,
  reason: string,
  evidence: Source,
): SdgLink {
  return {
    subject: { kind: "skill", skillId },
    target,
    kind: "transition",
    tier,
    confidence,
    reason,
    source: evidence,
  };
}

function gap(skillId: string, label: string, importance: number): GapSkill {
  return { skillId, label, importance };
}

type RoleTune = {
  fit: UnitScore;
  byScenario: ScenarioScores;
};

function buildSnapshot(
  asOf: IsoDate,
  tune: Record<string, RoleTune>,
): ResultsExample {
  const anthropic = source(
    "Anthropic Economic Index",
    "2026-09-01",
    "https://www.anthropic.com/economic-index",
    asOf,
  );
  const ilo = source(
    "ILO GenAI Exposure",
    "2025-05-01",
    "https://www.ilo.org/publications/generative-ai-and-jobs-global-analysis-potential-effects-job-quantity-and-quality",
    asOf,
  );
  const esco = source("ESCO v1.2", "2024-05-01", "https://esco.ec.europa.eu/en", asOf);
  const escoGreen = source(
    "ESCO green skills v1.2",
    "2024-05-01",
    "https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/green-skills-and-knowledge-concepts",
    asOf,
  );
  const arxiv = source(
    "arXiv momentum",
    asOf,
    "https://export.arxiv.org/api/query?search_query=all:skills",
    asOf,
  );
  const osdg = source("OSDG classifier", "2025-06-01", "https://www.osdg.ai/", asOf);
  const onet = source("O*NET Green", "2025-08-01", "https://www.onetonline.org/", asOf);
  const rules = source(
    "Laluan SDG transition rules",
    "2026-10-01",
    "https://sdgs.un.org/goals",
    asOf,
  );

  const roles: RoleResult[] = [
    {
      occupationId: DATA_OPS,
      title: "Data Operations Analyst",
      fit: tune[DATA_OPS].fit,
      exposure: 0.44,
      augmentation: 0.78,
      byScenario: tune[DATA_OPS].byScenario,
      robust: true,
      gap: [
        gap("power-query", "Data cleaning in Power Query", 0.91),
        gap("sql-basics", "SQL basics", 0.86),
        gap("looker-studio", "Dashboards in Looker Studio", 0.8),
        gap("check-ai-output", "Checking AI output for errors", 0.74),
        gap("process-documentation", "Process documentation", 0.66),
      ],
      sdg: [
        occupationLink(
          DATA_OPS,
          "4.4",
          "transition",
          "direct",
          0.92,
          "The move closes a skills gap with relevant training, which is target 4.4.",
          rules,
        ),
        occupationLink(
          DATA_OPS,
          "5.5",
          "transition",
          "direct",
          0.84,
          "A woman moving from clerical work into a digital role advances target 5.5.",
          rules,
        ),
        occupationLink(
          DATA_OPS,
          "8.6",
          "transition",
          "supporting",
          0.61,
          "OSDG marks this youth transition toward decent work at 0.61.",
          osdg,
        ),
      ],
      sources: [esco, arxiv],
      signalsAsOf: asOf,
      explanation: "Stays in the top three under every future, so this is the robust move.",
    },
    {
      occupationId: CX,
      title: "Customer Experience Specialist",
      fit: tune[CX].fit,
      exposure: 0.51,
      augmentation: 0.69,
      byScenario: tune[CX].byScenario,
      robust: false,
      gap: [
        gap("crm-tools", "CRM tools (Zendesk, Freshdesk)", 0.88),
        gap("ai-reply-drafting", "AI-assisted reply drafting", 0.81),
        gap("complaint-handling", "Complaint handling and de-escalation", 0.77),
        gap("feedback-analysis", "Customer feedback analysis", 0.7),
        gap("accessible-service", "Accessible service design", 0.64),
      ],
      sdg: [
        occupationLink(
          CX,
          "8.5",
          "transition",
          "direct",
          0.9,
          "Moving into steadier customer work is a step toward decent work, target 8.5.",
          rules,
        ),
        occupationLink(
          CX,
          "4.4",
          "transition",
          "supporting",
          0.58,
          "OSDG links the skills this role asks for to target 4.4 at 0.58.",
          osdg,
        ),
        occupationLink(
          CX,
          "10.2",
          "role",
          "inferred",
          0.46,
          "Designing customer service people can actually use can support target 10.2, and that agrees with the role's decent-work link.",
          source("UN SDG target text", "2025-01-01", "https://sdgs.un.org/goals/goal10", asOf),
        ),
      ],
      sources: [esco, osdg],
      signalsAsOf: asOf,
      explanation: "Ranks lower when the scenario punishes customer-facing routine work.",
    },
    {
      occupationId: ESG,
      title: "ESG Reporting Associate",
      fit: tune[ESG].fit,
      exposure: 0.36,
      augmentation: 0.62,
      byScenario: tune[ESG].byScenario,
      robust: false,
      gap: [
        gap("carbon-accounting", "Carbon accounting basics (Scope 1–3)", 0.9),
        gap("bursa-reporting", "Bursa sustainability reporting", 0.84),
        gap("esg-data-collection", "ESG data collection", 0.79),
        gap("supplier-surveys", "Supplier survey management", 0.71),
        gap("report-writing", "Report writing (BM and English)", 0.63),
      ],
      sdg: [
        occupationLink(
          ESG,
          "13.3",
          "role",
          "direct",
          0.93,
          "The work itself is climate reporting and awareness, which is target 13.3.",
          source("O*NET Green", "2025-08-01", "https://www.onetonline.org/", asOf),
        ),
        occupationLink(
          ESG,
          "12.6",
          "role",
          "supporting",
          0.72,
          "OSDG reads the occupation text as sustainability reporting, target 12.6, at 0.72.",
          osdg,
        ),
        occupationLink(
          ESG,
          "11.6",
          "role",
          "inferred",
          0.44,
          "City environmental data in these reports can support target 11.6, in line with the climate and reporting links.",
          source("UN SDG target text", "2025-01-01", "https://sdgs.un.org/goals/goal11", asOf),
        ),
      ],
      sources: [escoGreen, onet],
      signalsAsOf: asOf,
      explanation: "Her community interest adds a small bonus to this green role.",
    },
  ];

  const skillLinks: SdgLink[] = [
    skillLink("power-query", "4.4", "direct", 0.9, "Learning this skill is the training step in target 4.4.", rules),
    skillLink("sql-basics", "4.4", "direct", 0.9, "Learning this skill is the training step in target 4.4.", rules),
    skillLink("looker-studio", "4.4", "direct", 0.88, "Learning this skill is the training step in target 4.4.", rules),
    skillLink("check-ai-output", "4.4", "supporting", 0.62, "OSDG links checking model output to skills training at 0.62.", osdg),
    skillLink("process-documentation", "8.2", "supporting", 0.55, "OSDG links process documentation to productivity, target 8.2, at 0.55.", osdg),
    skillLink("crm-tools", "4.4", "direct", 0.86, "Learning this skill is the training step in target 4.4.", rules),
    skillLink("ai-reply-drafting", "4.4", "supporting", 0.57, "OSDG links assisted writing practice to target 4.4 at 0.57.", osdg),
    skillLink("complaint-handling", "8.5", "direct", 0.8, "This skill is part of delivering decent customer work, target 8.5.", rules),
    skillLink("feedback-analysis", "8.2", "supporting", 0.54, "OSDG links feedback analysis to productivity, target 8.2, at 0.54.", osdg),
    skillLink(
      "accessible-service",
      "10.2",
      "inferred",
      0.45,
      "Practising accessible service design can support target 10.2, and that agrees with the role's inclusion link.",
      source("UN SDG target text", "2025-01-01", "https://sdgs.un.org/goals/goal10", asOf),
    ),
    skillLink("carbon-accounting", "13.3", "direct", 0.91, "This skill is climate literacy applied at work, target 13.3.", onet),
    skillLink("bursa-reporting", "12.6", "supporting", 0.73, "OSDG links sustainability reporting practice to target 12.6 at 0.73.", osdg),
    skillLink("esg-data-collection", "12.6", "supporting", 0.7, "OSDG links ESG data collection to reporting, target 12.6, at 0.70.", osdg),
    skillLink("supplier-surveys", "12.6", "direct", 0.8, "Supplier data is how this role reports, which is target 12.6.", escoGreen),
    skillLink("report-writing", "4.4", "direct", 0.84, "Practising report writing is the training step in target 4.4.", rules),
  ];

  const response = AnalyzeResponseSchema.parse({
    signalsAsOf: asOf,
    currentWork: {
      exposure: 0.48,
      augmentation: 0.71,
      sources: [anthropic, ilo],
    },
    roles,
  });

  return {
    example: true,
    persona,
    response,
    tasks: TASKS,
    skillLinks: skillLinks.map((link) => SdgLinkSchema.parse(link)),
    targetLabels: AISYAH_TARGET_LABELS,
    roleStatus: AISYAH_ROLE_STATUS,
  };
}

const todayTune: Record<string, RoleTune> = {
  [DATA_OPS]: { fit: 0.72, byScenario: { co: 0.84, dis: 0.73, sup: 0.91 } },
  [CX]: { fit: 0.68, byScenario: { co: 0.76, dis: 0.49, sup: 0.62 } },
  [ESG]: { fit: 0.54, byScenario: { co: 0.63, dis: 0.67, sup: 0.74 } },
};

const priorTune: Record<string, RoleTune> = {
  [DATA_OPS]: { fit: 0.64, byScenario: { co: 0.68, dis: 0.61, sup: 0.79 } },
  [CX]: { fit: 0.71, byScenario: { co: 0.77, dis: 0.52, sup: 0.64 } },
  [ESG]: { fit: 0.51, byScenario: { co: 0.58, dis: 0.66, sup: 0.7 } },
};

/** Two dated snapshots. Today matches the approved results reference. */
export const AISYAH_RESULTS: Record<ExampleSignal, ResultsExample> = {
  today: buildSnapshot(EXAMPLE_AS_OF, todayTune),
  "thirty-days-ago": buildSnapshot(EXAMPLE_PRIOR_AS_OF, priorTune),
};

const REFRESH_DELAY_MS = 700;

/** Re-read the example snapshot. There is no network call. */
export function fetchAisyahResults(signal: ExampleSignal): Promise<ResultsExample> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(AISYAH_RESULTS[signal]), REFRESH_DELAY_MS);
  });
}
