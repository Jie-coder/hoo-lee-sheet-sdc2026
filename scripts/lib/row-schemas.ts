// Row schemas for the data/README.md CSVs that have no contract in
// src/types/contracts.ts: sources, keywords, exposure, and the occupations
// list this script proposes. camelCase, same style as contracts.ts.
import { z } from "zod";
import { ClusterIdSchema, IsoDateSchema } from "../../src/types/contracts";

export const DATA_FORMATS = ["API", "CSV", "PDF"] as const;
export const DataFormatSchema = z.enum(DATA_FORMATS);

export const SOURCE_USES = ["exposure", "trend", "scenario"] as const;
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

export const SIGNAL_DIRECTIONS = ["up", "down"] as const;
export const SignalDirectionSchema = z.enum(SIGNAL_DIRECTIONS);

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
