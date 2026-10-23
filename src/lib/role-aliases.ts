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
