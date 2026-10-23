// Precomputed lookup from common job titles (EN / BM / a few Chinese) to the
// closest of the 40 curated Laluan roles, or null when none is close. The
// table (src/data/role-aliases.json) was LLM-generated (DeepSeek via
// OpenCode) and hand-checked; it only maps names -- exposure always comes
// from the catalogue role's real data.
import roleAliasesJson from "@/data/role-aliases.json";

export type RoleAliasEntry = { roleId: string | null };

export const ROLE_ALIASES: Readonly<Record<string, RoleAliasEntry>> = roleAliasesJson as Record<string, RoleAliasEntry>;

/** Lowercase, trim, strip punctuation (keeps letters/digits in any script), collapse spaces. */
export function normalizeAliasKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * undefined = title not in the table; null = in the table but deliberately
 * mapped to no catalogue role; string = catalogue role id.
 */
export function lookupRoleAlias(title: string): string | null | undefined {
  const entry = ROLE_ALIASES[normalizeAliasKey(title)];
  return entry === undefined ? undefined : entry.roleId;
}

/**
 * Best-effort catalogue id for a CV's current job title: an exact
 * (normalised) catalogue title first, then the alias table. null when the
 * title is empty or not recognised — the CV then just has no current job.
 */
export function detectCurrentOccupationId(
  title: string | null | undefined,
  occupations: readonly { id: string; title: string }[],
): string | null {
  if (!title) return null;
  const key = normalizeAliasKey(title);
  if (!key) return null;
  const exact = occupations.find((occupation) => normalizeAliasKey(occupation.title) === key);
  if (exact) return exact.id;
  return lookupRoleAlias(title) ?? null;
}
