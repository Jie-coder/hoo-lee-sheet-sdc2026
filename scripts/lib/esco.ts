// Turns ESCO API occupation responses into occupation_skills.csv rows.
// Pure functions only: scripts/fetch-esco-skills.ts does the network calls.
// API docs: https://esco.ec.europa.eu/en/use-esco/use-esco-services-api
import type { OccupationSkillRow } from "./row-schemas";

export const ESCO_API_BASE = "https://ec.europa.eu/esco/api";

/**
 * The ESCO release we read. Pinned so the CSV can be regenerated exactly:
 * the API's unversioned default returns a slightly different skill list.
 */
export const DEFAULT_ESCO_VERSION = "v1.2.1";

/** Name of the ESCO row in sources.csv; every generated row cites it. */
export const ESCO_SOURCE_NAME = "ESCO";

export const OCCUPATION_SKILLS_HEADER = [
  "occupation_id",
  "skill_uri",
  "skill_label",
  "relation",
  "source_name",
  "as_of",
] as const;

type EscoSkillLink = { uri?: string; title?: string };

/** The part of an ESCO occupation response we use. */
export type EscoOccupationResponse = {
  uri?: string;
  title?: string;
  _links?: {
    hasEssentialSkill?: EscoSkillLink[];
    hasOptionalSkill?: EscoSkillLink[];
  };
};

export function escoOccupationUrl(occupationUri: string, version: string): string {
  const params = new URLSearchParams({ uri: occupationUri, language: "en", selectedVersion: version });
  return `${ESCO_API_BASE}/resource/occupation?${params.toString()}`;
}

/**
 * The skills of one occupation, exactly as ESCO lists them. Essential first,
 * then optional (only when asked), each sorted by label. Links without a
 * URI or title are dropped rather than guessed.
 */
export function occupationSkillRowsFromEsco(
  occupationId: string,
  response: EscoOccupationResponse,
  options: { includeOptional: boolean; asOf: string; sourceName?: string }
): OccupationSkillRow[] {
  const sourceName = options.sourceName ?? ESCO_SOURCE_NAME;
  const toRows = (links: EscoSkillLink[] | undefined, relation: "essential" | "optional") => {
    const seen = new Set<string>();
    return (links ?? [])
      .filter((link): link is { uri: string; title: string } => !!link.uri && !!link.title)
      .filter((link) => (seen.has(link.uri) ? false : (seen.add(link.uri), true)))
      .map((link) => ({
        occupationId,
        skillUri: link.uri,
        skillLabel: link.title.trim(),
        relation,
        sourceName,
        asOf: options.asOf,
      }))
      .sort((a, b) => a.skillLabel.localeCompare(b.skillLabel));
  };

  const essential = toRows(response._links?.hasEssentialSkill, "essential");
  if (!options.includeOptional) return essential;

  // A skill ESCO lists as both keeps "essential".
  const essentialUris = new Set(essential.map((row) => row.skillUri));
  const optional = toRows(response._links?.hasOptionalSkill, "optional").filter(
    (row) => !essentialUris.has(row.skillUri)
  );
  return [...essential, ...optional];
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** occupation_skills.csv text, header first, one line per row, trailing newline. */
export function formatOccupationSkillsCsv(rows: OccupationSkillRow[]): string {
  const lines = [OCCUPATION_SKILLS_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [row.occupationId, row.skillUri, row.skillLabel, row.relation, row.sourceName, row.asOf]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}
