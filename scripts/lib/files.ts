// Registry of the CSV files this importer understands: canonical key,
// filename, --only aliases, and the exact snake_case header set from
// data/README.md (courses, programmes, sources, keywords, exposure) plus
// the occupations.csv header this script proposes.

export const FILE_KEYS = [
  "courses",
  "programmes",
  "sources",
  "keywords",
  "exposure",
  "occupations",
] as const;
export type FileKey = (typeof FILE_KEYS)[number];

export type FileSpec = {
  key: FileKey;
  filename: string;
  aliases: string[];
  headers: string[];
};

export const FILE_SPECS: Record<FileKey, FileSpec> = {
  courses: {
    key: "courses",
    filename: "courses.csv",
    aliases: ["courses"],
    headers: [
      "id",
      "title",
      "provider",
      "url",
      "languages",
      "hours",
      "cost_type",
      "certificate",
      "skills",
      "skill_uris",
      "sdg_target",
      "sdg_reason",
      "summary",
      "last_checked",
      "notes",
      "mode",
    ],
  },
  programmes: {
    key: "programmes",
    filename: "programmes.csv",
    aliases: ["programmes", "programs"],
    headers: [
      "id",
      "name",
      "agency",
      "url",
      "benefits",
      "cost_type",
      "deadline",
      "age_min",
      "age_max",
      "citizen",
      "employment",
      "perkeso_contributor",
      "states",
      "last_checked",
      "notes",
    ],
  },
  sources: {
    key: "sources",
    filename: "sources.csv",
    aliases: ["sources"],
    headers: [
      "name",
      "url",
      "publisher",
      "what_it_measures",
      "update_frequency",
      "last_updated",
      "data_format",
      "licence",
      "use_for",
      "notes",
    ],
  },
  keywords: {
    key: "keywords",
    filename: "keywords.csv",
    aliases: ["keywords"],
    headers: [
      "keyword",
      "arxiv_query",
      "skills",
      "skill_uris",
      "direction",
      "count_last_90d",
      "count_prev_90d",
      "checked_on",
    ],
  },
  exposure: {
    key: "exposure",
    filename: "exposure.csv",
    aliases: ["exposure"],
    headers: [
      "occupation",
      "code",
      "exposure_value",
      "scale",
      "source_name",
      "source_url",
      "table_or_page",
      "as_of",
      "notes",
    ],
  },
  occupations: {
    key: "occupations",
    filename: "occupations.csv",
    aliases: ["occupations"],
    headers: [
      "id",
      "esco_uri",
      "isco_code",
      "title_en",
      "title_ms",
      "description",
      "cluster",
      "is_emerging",
      "last_checked",
      "notes",
    ],
  },
};

export type ResolveOnlyResult = { ok: true; keys: FileKey[] } | { ok: false; error: string };

/** Resolves a comma-separated --only value into canonical file keys. */
export function resolveOnly(only: string | undefined): ResolveOnlyResult {
  if (only === undefined) return { ok: true, keys: [...FILE_KEYS] };

  const names = only
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);

  if (names.length === 0) return { ok: true, keys: [...FILE_KEYS] };

  const keys: FileKey[] = [];
  const unknown: string[] = [];

  for (const name of names) {
    const spec = Object.values(FILE_SPECS).find((candidate) => candidate.aliases.includes(name));
    if (!spec) {
      unknown.push(name);
      continue;
    }
    if (!keys.includes(spec.key)) keys.push(spec.key);
  }

  if (unknown.length > 0) {
    const known = Object.values(FILE_SPECS)
      .flatMap((spec) => spec.aliases)
      .join(", ");
    return {
      ok: false,
      error: `unknown --only name(s): ${unknown.join(", ")} (expected one of: ${known})`,
    };
  }

  return { ok: true, keys };
}

/** Header mismatch, as missing (required but absent) and unexpected (present but unknown) columns. */
export function diffHeaders(
  expected: string[],
  actual: string[]
): { missing: string[]; unexpected: string[] } {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((column) => !actualSet.has(column)),
    unexpected: actual.filter((column) => !expectedSet.has(column)),
  };
}
