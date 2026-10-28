// The curated data the app scores against, compiled from data/*.csv by
// scripts/build-catalogue.ts into src/data/catalogue.json. Types only here,
// plus the loader: no file system access, so it works on any host.
import catalogueJson from "@/data/catalogue.json";
import type { ClusterId, Course, IsoDate, Programme, SdgTargetId } from "@/types/contracts";

/** One dataset from sources.csv, by name. */
export type CatalogueSource = {
  name: string;
  url: string;
  publisher: string;
  lastUpdated: IsoDate;
};

/** A published exposure figure for one occupation, copied from exposure.csv. */
export type CatalogueExposure = {
  value: number;
  sourceName: string;
  tableOrPage: string;
  asOf: IsoDate;
  /** True when ISCO-08 has no code for this exact job, so the figure is for a wider group. */
  groupEstimate: boolean;
};

/** The SDG target one ESCO skill group contributes to, from skill_group_sdg.csv. */
export type CatalogueGroupSdg = {
  target: SdgTargetId;
  reason: string;
};

/** An SDG target for one occupation, from occupation_sdg.csv. */
export type CatalogueSdg = {
  target: string;
  label: string;
  tier: "direct" | "supporting";
  reason: string;
  sourceUrl: string;
  checkedOn: IsoDate;
};

export type CatalogueOccupation = {
  id: string;
  title: string;
  cluster: ClusterId;
  iscoCode: string | null;
  escoUri: string | null;
  /** ESCO skill ids (lower-case UUIDs) ESCO lists as essential. */
  essentialSkillIds: string[];
  exposure: CatalogueExposure | null;
  sdg: CatalogueSdg[];
};

/**
 * arXiv momentum for one skill: m_s = ln((recent + 1) / (previous + 1)),
 * averaged over the keywords mapped to the skill (not summed, so one busy
 * keyword can't drown out the others).
 */
export type CatalogueSignal = {
  momentum: number;
  keywords: string[];
  checkedOn: IsoDate;
};

/** One keywords.csv row as counted on arXiv, for the Future Skills Radar. */
export type CatalogueKeyword = {
  keyword: string;
  skillIds: string[];
  recent: number;
  previous: number;
  direction: "up" | "down" | "flat";
  /** ln((recent + 1) / (previous + 1)). */
  momentum: number;
  /** False when both windows have fewer than 20 papers: shown, but not used for scoring. */
  enough: boolean;
  recentWindow: { start: IsoDate; end: IsoDate };
  previousWindow: { start: IsoDate; end: IsoDate };
  /** arXiv API query for the recent window, so anyone can check the count. */
  url: string;
};

/** A sample persona's CV skill, matched to an ESCO skill by hand (data/persona_skills.csv). */
export type CataloguePersonaSkill = {
  cvSkill: string;
  skillId: string;
  label: string;
};

export type Catalogue = {
  /** Latest checked_on date in keywords.csv: the date the trend signal describes. */
  signalsAsOf: IsoDate;
  occupations: CatalogueOccupation[];
  /** Skill id -> English label. Mostly ESCO ids; "laluan:" ids are custom skills (see customSkills). */
  skills: Record<string, string>;
  /** Laluan custom skills (data/custom_skills.csv), keyed by their "laluan:" id. Not ESCO concepts. */
  customSkills: Record<string, { label: string; description: string }>;
  /** ESCO skill id -> its group id in ESCO's skills hierarchy (data/skill_groups.csv). */
  skillGroups: Record<string, string>;
  /** ESCO group id -> label, e.g. "managing, gathering and storing digital data". */
  groupLabels: Record<string, string>;
  /** ESCO group id -> its SDG target and reason (data/skill_group_sdg.csv). */
  groupSdg: Record<string, CatalogueGroupSdg>;
  signals: Record<string, CatalogueSignal>;
  /** The same keywords counted about 30 days earlier (data/keywords_prior.csv), or null when not collected. */
  priorSignalsAsOf: IsoDate | null;
  priorSignals: Record<string, CatalogueSignal> | null;
  /** Every keyword's counts, per snapshot (prior is null when not collected). */
  keywords: { today: CatalogueKeyword[]; prior: CatalogueKeyword[] | null };
  sources: Record<string, CatalogueSource>;
  courses: Course[];
  programmes: Programme[];
  personaSkills: Record<string, CataloguePersonaSkill[]>;
};

/** Names in sources.csv that the scoring cites. Checked by the catalogue build. */
export const SOURCE_NAMES = {
  exposure: "ILO GenAI Exposure 2025",
  skills: "ESCO",
  trend: "arXiv API",
} as const;

// JSON imports type enums as plain strings; scripts/lib/catalogue-build.test.ts
// checks the file was built by buildCatalogue, which returns a real Catalogue.
export const CATALOGUE = catalogueJson as unknown as Catalogue;
