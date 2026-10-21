// Cell-level parsing rules shared by every CSV: code lists are comma-separated,
// name/URI lists are semicolon-separated, blank means null, yes/no means boolean.

/** Splits a comma-separated cell (language codes, employment, states). */
export function splitCodes(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Splits a semicolon-separated cell (skill names, skill URIs). */
export function splitNames(value: string): string[] {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** True when a cell is empty after trimming: the CSV's spelling of "blank". */
export function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

export type YesNoResult =
  | { ok: true; value: boolean | null }
  | { ok: false; error: string };

/**
 * Parses a yes/no/blank cell. Blank means null (not stated); anything other
 * than "yes" or "no" is a validation error.
 */
export function parseYesNoOrBlank(value: string): YesNoResult {
  if (isBlank(value)) return { ok: true, value: null };
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return { ok: true, value: true };
  if (normalized === "no") return { ok: true, value: false };
  return { ok: false, error: `use "yes", "no", or leave blank (got "${value}")` };
}

/** Parses a required (never-blank) yes/no cell, such as courses.certificate. */
export function parseYesNo(value: string): { ok: true; value: boolean } | { ok: false; error: string } {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return { ok: true, value: true };
  if (normalized === "no") return { ok: true, value: false };
  return { ok: false, error: `use "yes" or "no" (got "${value}")` };
}

export type IntResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/** Parses a non-negative integer cell, or null when blank. */
export function parseIntOrBlank(value: string): IntResult {
  if (isBlank(value)) return { ok: true, value: null };
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: `expected a whole number or blank (got "${value}")` };
  }
  return { ok: true, value: Number(trimmed) };
}

/** Parses a positive number cell (hours, exposure_value): required, never blank. */
export function parseNumber(value: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: `expected a number (got "${value}")` };
  }
  return { ok: true, value: Number(trimmed) };
}

const ESCO_URI_RE =
  /^https?:\/\/data\.europa\.eu\/esco\/(?:skill|occupation)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed ESCO concept URI (skill or occupation). */
export function isEscoUri(value: string): boolean {
  return ESCO_URI_RE.test(value.trim());
}

/** Stable id derived from an ESCO URI: the concept UUID at the end of the path. */
export function escoUriToId(uri: string): string {
  const segments = uri.trim().split("/");
  return segments[segments.length - 1].toLowerCase();
}
