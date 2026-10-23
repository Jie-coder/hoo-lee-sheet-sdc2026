// Builds the app's catalogue (src/lib/catalogue.ts types) from data/*.csv.
// Uses the importer's own validation (runFile), so the app can only ship
// data that passes the same checks as --apply. Pure: reads files, returns an
// object; scripts/build-catalogue.ts writes it to src/data/catalogue.json.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { IsoDateSchema, SdgTargetIdSchema } from "../../src/types/contracts";
import type {
  Catalogue,
  CatalogueKeyword,
  CatalogueOccupation,
  CataloguePersonaSkill,
  CatalogueSignal,
} from "../../src/lib/catalogue";
import { SOURCE_NAMES } from "../../src/lib/catalogue";
import { skillMomentum } from "../../src/lib/scoring";
import { deriveSkills, runFile } from "../import-data";
import { arxivCountUrl, arxivWindows, hasEnoughPapers } from "./arxiv";
import { escoUriToId, isCustomSkillId, isEscoUri } from "./cells";
import { parseCsv } from "./csv";
import { mapKeywordRow } from "./mappers";
import type { FileKey } from "./files";

const OccupationSdgRowSchema = z.strictObject({
  occupation_id: z.string().min(1),
  target: SdgTargetIdSchema,
  target_label: z.string().min(1),
  tier: z.enum(["direct", "supporting"]),
  reason: z.string().min(1),
  source_url: z.url(),
  checked_on: IsoDateSchema,
});

const SkillGroupRowSchema = z.strictObject({
  skill_uri: z.string().refine((uri) => isEscoUri(uri) && uri.includes("/esco/skill/"), "not an ESCO skill URI"),
  group_uri: z.url(),
  group_label: z.string().min(1),
  source_name: z.string().min(1),
  as_of: IsoDateSchema,
});

const PersonaSkillRowSchema = z.strictObject({
  persona_id: z.string().min(1),
  cv_skill: z.string().min(1),
  esco_uri: z.string().refine((uri) => isEscoUri(uri) && uri.includes("/esco/skill/"), "not an ESCO skill URI"),
  esco_label: z.string().min(1),
  note: z.string(),
});

const CustomSkillRowSchema = z.strictObject({
  id: z.string().refine(isCustomSkillId, 'not a Laluan custom skill id ("laluan:<slug>")'),
  label_en: z.string().min(1),
  description: z.string().refine((d) => /not an ESCO concept/i.test(d), 'description must say "not an ESCO concept"'),
});

/** Exposure notes that say the ILO figure is for a wider occupation group. */
const GROUP_ESTIMATE_NOTE = /no [\w\s-]*ISCO|ISCO-08 has no|shares (ISCO )?\d{4}|catch-all/i;

function readRows(dir: string, filename: string): Record<string, string>[] {
  const { header, rows } = parseCsv(readFileSync(join(dir, filename), "utf8"));
  return rows.map((cells) => Object.fromEntries(header.map((column, i) => [column, cells[i] ?? ""])));
}

function parseRows<T>(dir: string, filename: string, schema: z.ZodType<T>): T[] {
  return readRows(dir, filename).map((raw, index) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`${filename} row ${index + 2}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }
    return parsed.data;
  });
}

/**
 * Momentum per skill from one keywords file: the mean of each mapped
 * keyword's own momentum. Null when the file has no usable rows.
 */
/** Every valid keyword row of one keywords file, with its counts, windows and a checkable arXiv URL. */
function keywordRows(dir: string, filename: string): CatalogueKeyword[] {
  const rows: CatalogueKeyword[] = [];
  for (const [index, raw] of readRows(dir, filename).entries()) {
    const { value } = mapKeywordRow(raw, index + 2);
    if (!value) continue;
    const windows = arxivWindows(value.checkedOn);
    rows.push({
      keyword: value.keyword,
      skillIds: value.skillUris.map(escoUriToId),
      recent: value.countLast90d,
      previous: value.countPrev90d,
      direction: value.direction,
      momentum: skillMomentum(value.countLast90d, value.countPrev90d),
      enough: hasEnoughPapers(value.countLast90d, value.countPrev90d),
      recentWindow: windows.recent,
      previousWindow: windows.previous,
      url: arxivCountUrl(value.arxivQuery, windows.recent),
    });
  }
  return rows;
}

function signalSnapshot(dir: string, filename: string): { signals: Record<string, CatalogueSignal>; asOf: string } | null {
  const perSkill = new Map<string, { momenta: number[]; keywords: string[]; checkedOn: string }>();
  for (const [index, raw] of readRows(dir, filename).entries()) {
    const { value } = mapKeywordRow(raw, index + 2);
    // Too few papers in both windows to read as a trend: 1 vs 3 would look like a huge swing.
    if (!value || !hasEnoughPapers(value.countLast90d, value.countPrev90d)) continue;
    const momentum = skillMomentum(value.countLast90d, value.countPrev90d);
    for (const uri of value.skillUris) {
      const id = escoUriToId(uri);
      const entry = perSkill.get(id) ?? { momenta: [], keywords: [], checkedOn: value.checkedOn };
      entry.momenta.push(momentum);
      entry.keywords.push(value.keyword);
      if (value.checkedOn > entry.checkedOn) entry.checkedOn = value.checkedOn;
      perSkill.set(id, entry);
    }
  }
  const asOf = [...perSkill.values()].reduce((latest, entry) => (entry.checkedOn > latest ? entry.checkedOn : latest), "");
  if (!asOf) return null;
  const signals = Object.fromEntries(
    [...perSkill].map(([id, entry]) => [
      id,
      {
        momentum: entry.momenta.reduce((sum, m) => sum + m, 0) / entry.momenta.length,
        keywords: entry.keywords,
        checkedOn: entry.checkedOn,
      },
    ])
  );
  return { signals, asOf };
}

/** Throws with every problem listed when any importer-checked file has errors. */
function checkedOutcome(key: FileKey, dir: string, options: { optional?: boolean } = {}) {
  const outcome = runFile(key, dir);
  const errors = outcome.fileReport.issues.filter((issue) => issue.severity === "error");
  if (!outcome.fileReport.present) {
    if (options.optional) return outcome;
    throw new Error(`${outcome.fileReport.file} is missing from ${dir}`);
  }
  if (errors.length > 0) {
    throw new Error(
      `${outcome.fileReport.file} has ${errors.length} error(s); run npx tsx scripts/import-data.ts --dir ${dir}`
    );
  }
  return outcome;
}

export function buildCatalogue(dir: string): Catalogue {
  const courses = checkedOutcome("courses", dir);
  const programmes = checkedOutcome("programmes", dir);
  const sources = checkedOutcome("sources", dir);
  const keywords = checkedOutcome("keywords", dir);
  const exposure = checkedOutcome("exposure", dir);
  const occupations = checkedOutcome("occupations", dir);
  const occupationSkills = checkedOutcome("occupation_skills", dir);

  const sourceByName = Object.fromEntries(
    sources.validSources.map((source) => [
      source.name,
      { name: source.name, url: source.url, publisher: source.publisher, lastUpdated: source.lastUpdated },
    ])
  );
  for (const name of Object.values(SOURCE_NAMES)) {
    if (!sourceByName[name]) throw new Error(`sources.csv has no row named "${name}", which scoring cites`);
  }

  // Skill labels: courses and keywords first, so the team's curated label wins over ESCO's.
  const skills = Object.fromEntries(
    deriveSkills([...courses.skillPairs, ...keywords.skillPairs, ...occupationSkills.skillPairs]).map((skill) => [
      skill.id,
      skill.labelEn,
    ])
  );

  // Laluan custom skills (data/custom_skills.csv): AI-era skills ESCO lacks.
  // Their label comes from the file, never from ESCO, and every "laluan:" id a
  // course uses must be defined there.
  const customSkills: Catalogue["customSkills"] = {};
  for (const row of parseRows(dir, "custom_skills.csv", CustomSkillRowSchema)) {
    if (customSkills[row.id]) throw new Error(`custom_skills.csv lists ${row.id} twice`);
    customSkills[row.id] = { label: row.label_en, description: row.description };
    skills[row.id] = row.label_en;
  }
  for (const id of Object.keys(skills)) {
    if (isCustomSkillId(id) && !customSkills[id]) {
      throw new Error(`${id} is used in the data but not defined in custom_skills.csv`);
    }
  }

  const today = signalSnapshot(dir, "keywords.csv");
  if (!today) throw new Error("keywords.csv has no valid rows, so there is no trend signal");
  const { signals, asOf: signalsAsOf } = today;
  // Optional: the same keywords counted 30 days earlier (T10).
  checkedOutcome("keywords_prior", dir, { optional: true });
  const prior = existsSync(join(dir, "keywords_prior.csv")) ? signalSnapshot(dir, "keywords_prior.csv") : null;
  if (prior && prior.asOf >= signalsAsOf) {
    throw new Error(`keywords_prior.csv (as of ${prior.asOf}) must be older than keywords.csv (as of ${signalsAsOf})`);
  }

  const sdgRows = parseRows(dir, "occupation_sdg.csv", OccupationSdgRowSchema);
  const occupationIds = new Set(occupations.validOccupations.map((occupation) => occupation.id));
  for (const row of sdgRows) {
    if (!occupationIds.has(row.occupation_id)) throw new Error(`occupation_sdg.csv: unknown occupation_id ${row.occupation_id}`);
  }

  const occupationList: CatalogueOccupation[] = occupations.validOccupations.map((occupation) => {
    const exposureRow = exposure.validExposures.find((row) => row.occupation === occupation.titleEn);
    const sdg = sdgRows
      .filter((row) => row.occupation_id === occupation.id)
      .map((row) => ({
        target: row.target,
        label: row.target_label,
        tier: row.tier,
        reason: row.reason,
        sourceUrl: row.source_url,
        checkedOn: row.checked_on,
      }));
    if (sdg.length === 0 || sdg.length > 3) {
      throw new Error(`occupation_sdg.csv: ${occupation.id} needs 1 to 3 targets, has ${sdg.length}`);
    }
    return {
      id: occupation.id,
      // ESCO titles are lower case ("data analyst"); show them in sentence case.
      title: occupation.titleEn.charAt(0).toUpperCase() + occupation.titleEn.slice(1),
      cluster: occupation.cluster,
      iscoCode: occupation.iscoCode,
      escoUri: occupation.escoUri,
      essentialSkillIds: occupationSkills.validOccupationSkills
        .filter((row) => row.occupationId === occupation.id && row.relation === "essential")
        .map((row) => escoUriToId(row.skillUri)),
      exposure: exposureRow
        ? {
            value: exposureRow.exposureValue,
            sourceName: exposureRow.sourceName,
            tableOrPage: exposureRow.tableOrPage,
            asOf: exposureRow.asOf,
            groupEstimate: GROUP_ESTIMATE_NOTE.test(exposureRow.notes),
          }
        : null,
      sdg,
    };
  });

  const personaSkills: Record<string, CataloguePersonaSkill[]> = {};
  for (const row of parseRows(dir, "persona_skills.csv", PersonaSkillRowSchema)) {
    (personaSkills[row.persona_id] ??= []).push({
      cvSkill: row.cv_skill,
      skillId: escoUriToId(row.esco_uri),
      label: row.esco_label,
    });
    skills[escoUriToId(row.esco_uri)] ??= row.esco_label;
  }

  const skillGroups: Record<string, string> = {};
  const groupLabels: Record<string, string> = {};
  for (const row of parseRows(dir, "skill_groups.csv", SkillGroupRowSchema)) {
    const groupId = escoUriToId(row.group_uri);
    skillGroups[escoUriToId(row.skill_uri)] = groupId;
    groupLabels[groupId] = row.group_label;
  }

  return {
    signalsAsOf,
    occupations: occupationList,
    skills,
    customSkills,
    skillGroups,
    groupLabels,
    signals,
    priorSignalsAsOf: prior?.asOf ?? null,
    priorSignals: prior?.signals ?? null,
    keywords: {
      today: keywordRows(dir, "keywords.csv"),
      prior: prior ? keywordRows(dir, "keywords_prior.csv") : null,
    },
    sources: sourceByName,
    courses: courses.validCourses,
    programmes: programmes.validProgrammes,
    personaSkills,
  };
}
