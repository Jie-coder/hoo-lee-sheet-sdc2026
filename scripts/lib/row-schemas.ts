// Row schemas for the data/README.md CSVs that have no contract in
// src/types/contracts.ts: sources, keywords, exposure, and the occupations
// list this script proposes, demand and scenarios. camelCase, same style as
// contracts.ts.
import { z } from "zod";
import { ClusterIdSchema, IsoDateSchema, ScenarioIdSchema, SdgTargetIdSchema } from "../../src/types/contracts";

export const DATA_FORMATS = ["API", "CSV", "PDF"] as const;
export const DataFormatSchema = z.enum(DATA_FORMATS);

// "skills": a skills taxonomy such as ESCO (migration 20261021190000).
// "demand": labour-market data such as OpenDOSM (migration 20261022090000).
export const SOURCE_USES = ["exposure", "trend", "scenario", "skills", "demand"] as const;
export const SourceUseSchema = z.enum(SOURCE_USES);

/** One row of sources.csv: a reusable dataset, with a licence Henry has checked. */
export const SourceRowSchema = z
  .strictObject({
    name: z.string().min(1),
    url: z.url(),
    publisher: z.string().min(1),
    whatItMeasures: z.string().min(1),
    updateFrequency: z.string().min(1),
    lastUpdated: IsoDateSchema,
    dataFormat: DataFormatSchema,
    licence: z.string().min(1),
    useFor: SourceUseSchema,
    notes: z.string(),
  })
  .describe("sources.csv row: dataset metadata and the licence that allows reuse.");
export type SourceRow = z.infer<typeof SourceRowSchema>;

// "flat": the two 90-day windows differ by 10% or less (scripts/lib/arxiv.ts).
export const SIGNAL_DIRECTIONS = ["up", "down", "flat"] as const;
export const SignalDirectionSchema = z.enum(SIGNAL_DIRECTIONS);
export type SignalDirection = z.infer<typeof SignalDirectionSchema>;

/** One row of keywords.csv: an arXiv keyword mapped to one or more ESCO skills. */
export const KeywordRowSchema = z
  .strictObject({
    keyword: z.string().min(1),
    arxivQuery: z.string().min(1),
    skills: z.array(z.string().min(1)).min(1),
    skillUris: z.array(z.url()).min(1),
    direction: SignalDirectionSchema,
    countLast90d: z.number().int().nonnegative(),
    countPrev90d: z.number().int().nonnegative(),
    checkedOn: IsoDateSchema,
    notes: z.string(),
  })
  .describe("keywords.csv row: arXiv keyword momentum for one or more skills.");
export type KeywordRow = z.infer<typeof KeywordRowSchema>;

/** One row of exposure.csv: a published exposure figure for one occupation. */
export const ExposureRowSchema = z
  .strictObject({
    occupation: z.string().min(1),
    code: z.string().min(1),
    exposureValue: z.number(),
    scale: z.string().min(1),
    sourceName: z.string().min(1),
    sourceUrl: z.url(),
    tableOrPage: z.string(),
    asOf: IsoDateSchema,
    notes: z.string(),
  })
  .describe("exposure.csv row: one published exposure value, copied as-is.");
export type ExposureRow = z.infer<typeof ExposureRowSchema>;

/**
 * One row of skill_group_sdg.csv: the one SDG target a group in ESCO's skills
 * hierarchy contributes to, with the reason and the date it was checked.
 */
export const SkillGroupSdgRowSchema = z
  .strictObject({
    groupUri: z.url(),
    groupLabel: z.string().min(1),
    sdgTarget: SdgTargetIdSchema,
    sdgReason: z.string().min(1),
    checkedOn: IsoDateSchema,
  })
  .describe("skill_group_sdg.csv row: one SDG target for one ESCO skill group.");
export type SkillGroupSdgRow = z.infer<typeof SkillGroupSdgRowSchema>;

export const SKILL_RELATIONS = ["essential", "optional"] as const;
export const SkillRelationSchema = z.enum(SKILL_RELATIONS);

/**
 * One row of occupation_skills.csv: one ESCO skill of one occupation, copied
 * from the ESCO API by scripts/fetch-esco-skills.ts. Never written by hand.
 */
export const OccupationSkillRowSchema = z
  .strictObject({
    occupationId: z.string().min(1),
    skillUri: z.url(),
    skillLabel: z.string().min(1),
    relation: SkillRelationSchema,
    sourceName: z.string().min(1),
    asOf: IsoDateSchema,
  })
  .describe("occupation_skills.csv row: an ESCO essential/optional skill of one occupation.");
export type OccupationSkillRow = z.infer<typeof OccupationSkillRowSchema>;

/**
 * Proposed occupations.csv row (data/README.md does not define this file
 * yet). Columns mirror the public.occupations table and ClusterIdSchema.
 */
export const OccupationRowSchema = z
  .strictObject({
    id: z.string().min(1),
    escoUri: z.url().nullable(),
    iscoCode: z.string().nullable(),
    titleEn: z.string().min(1),
    titleMs: z.string().min(1),
    description: z.string(),
    cluster: ClusterIdSchema,
    isEmerging: z.boolean(),
    lastChecked: IsoDateSchema,
    notes: z.string(),
  })
  .describe("Proposed occupations.csv row: matches public.occupations + ClusterId.");
export type OccupationRow = z.infer<typeof OccupationRowSchema>;

/** ISCO-08 / MASCO major group: the first digit of an ISCO code (0 = armed forces). */
export const IscoMajorGroupSchema = z.string().regex(/^[0-9]$/, "expected one digit, 0-9");

/** A data period: a year (2025), a quarter (2025-Q3) or a month (2025-07). */
export const PeriodSchema = z.string().regex(/^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$/, "expected YYYY, YYYY-Q1..Q4 or YYYY-MM");

/**
 * One row of demand.csv: a published labour-market figure for one ISCO
 * major group, as it applies to one of our clusters. Written by
 * scripts/fetch-dosm-demand.ts; value and prev_value are copied as published.
 */
export const DemandRowSchema = z
  .strictObject({
    cluster: ClusterIdSchema,
    iscoMajorGroup: IscoMajorGroupSchema,
    metric: z.string().min(1),
    value: z.number().nonnegative(),
    period: PeriodSchema,
    prevValue: z.number().positive(),
    prevPeriod: PeriodSchema,
    sourceName: z.string().min(1),
    sourceUrl: z.url(),
    tableOrDataset: z.string().min(1),
    asOf: IsoDateSchema,
    notes: z.string(),
  })
  .describe("demand.csv row: one published labour-market figure for an ISCO major group in a cluster.");
export type DemandRow = z.infer<typeof DemandRowSchema>;

/**
 * One row of scenarios.csv: one cluster's demand multiplier in one scenario,
 * with the published figure it comes from (demand_multiplier = 1 + net growth / 100).
 */
export const ScenarioRowSchema = z
  .strictObject({
    scenarioId: ScenarioIdSchema,
    cluster: ClusterIdSchema,
    demandMultiplier: z.number().nonnegative(),
    theta: z.number().nonnegative(),
    sourceName: z.string().min(1),
    sourceUrl: z.url(),
    pageOrFigure: z.string().min(1),
    quoteOrFigure: z.string().min(1),
    asOf: IsoDateSchema,
    notes: z.string(),
  })
  .describe("scenarios.csv row: one cluster's cited demand multiplier in one scenario.");
export type ScenarioRow = z.infer<typeof ScenarioRowSchema>;
