// Helpers for the printable Laluan Certificate of Completion (/certificate).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "DD Mon YYYY" with English month abbreviations, whatever the runtime locale. */
export function formatCertificateDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export const CERTIFICATE_NAME_KEY = "laluan:certificate-name:v1";
const MAX_NAME_CHARS = 120;

/** Trimmed, whitespace-collapsed, length-capped name; "" if empty. */
export function cleanLearnerName(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_CHARS);
}

export function loadCertificateName(): string | null {
  try {
    const stored = window.localStorage.getItem(CERTIFICATE_NAME_KEY);
    return stored ? cleanLearnerName(stored) || null : null;
  } catch {
    return null;
  }
}

export function saveCertificateName(name: string): void {
  try {
    window.localStorage.setItem(CERTIFICATE_NAME_KEY, cleanLearnerName(name));
  } catch {
    // Private mode / quota: the name just won't persist.
  }
}

/** Titles for the verified item ids, in the given order; unknown ids are skipped. */
export function verifiedCourseTitles(
  verifiedIds: readonly string[],
  titles: Readonly<Record<string, string>>,
): string[] {
  return verifiedIds.map((id) => titles[id]).filter((title): title is string => Boolean(title));
}
