// The curated data the app scores against, compiled from data/*.csv by
// scripts/build-catalogue.ts into src/data/catalogue.json. Types only here,
// plus the loader: no file system access, so it works on any host.
import catalogueJson from "@/data/catalogue.json";
import type { ClusterId, Course, IsoDate, Programme } from "@/types/contracts";

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
  /** ESCO skill id -> English label. */
  skills: Record<string, string>;
  /** ESCO skill id -> its group id in ESCO's skills hierarchy (data/skill_groups.csv). */
  skillGroups: Record<string, string>;
  /** ESCO group id -> label, e.g. "managing, gathering and storing digital data". */
  groupLabels: Record<string, string>;
  signals: Record<string, CatalogueSignal>;
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
