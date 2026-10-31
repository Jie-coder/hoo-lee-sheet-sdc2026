// Self-reported programme/course completion, stored only in this browser's
// localStorage (one entry per chosen role's pathway). Nothing is sent anywhere
// and nothing is verified: a certificate URL is just a link the learner pasted.
// Verified Coursera certificate integration is future work (docs/programme-proof.md).

export type StepProgress = {
  /** ISO timestamp of when the learner marked the step done. */
  completedAt: string;
  /** Optional http(s) link the learner pasted as proof. Not verified. */
  certificateUrl?: string;
};

/** Progress keyed by catalogue item id (course or programme). */
export type PathwayProgress = Record<string, StepProgress>;

const KEY_PREFIX = "laluan:progress:v1:";

export function progressStorageKey(pathwayId: string): string {
  return `${KEY_PREFIX}${pathwayId}`;
}

/** Trimmed URL if it is a valid http(s) URL, otherwise null. */
export function normalizeCertificateUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitize(value: unknown): PathwayProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: PathwayProgress = {};
  for (const [itemId, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object") continue;
    const { completedAt, certificateUrl } = entry as Record<string, unknown>;
    if (typeof completedAt !== "string") continue;
    const url = typeof certificateUrl === "string" ? normalizeCertificateUrl(certificateUrl) : null;
    out[itemId] = url ? { completedAt, certificateUrl: url } : { completedAt };
  }
  return out;
}

/** Reads saved progress; returns {} on the server, on missing or corrupt data. */
export function loadProgress(pathwayId: string): PathwayProgress {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(progressStorageKey(pathwayId));
    return raw ? sanitize(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** Saves progress; silently does nothing where storage is unavailable or full. */
export function saveProgress(pathwayId: string, progress: PathwayProgress): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (Object.keys(progress).length === 0) storage.removeItem(progressStorageKey(pathwayId));
    else storage.setItem(progressStorageKey(pathwayId), JSON.stringify(progress));
  } catch {
    // Private mode / quota: progress just won't persist.
  }
}

/** Marks an item done (keeping any existing certificate) or removes it. */
export function setCompleted(
  progress: PathwayProgress,
  itemId: string,
  done: boolean,
  now: Date = new Date(),
): PathwayProgress {
  if (!done) {
    const { [itemId]: _removed, ...rest } = progress;
    void _removed;
    return rest;
  }
  if (progress[itemId]) return progress;
  return { ...progress, [itemId]: { completedAt: now.toISOString() } };
}

/**
 * Sets or clears the certificate link on a completed item. Returns null when
 * the text is non-empty but not a valid http(s) URL, or the item isn't done.
 */
export function setCertificateUrl(
  progress: PathwayProgress,
  itemId: string,
  input: string,
): PathwayProgress | null {
  const current = progress[itemId];
  if (!current) return null;
  if (!input.trim()) return { ...progress, [itemId]: { completedAt: current.completedAt } };
  const url = normalizeCertificateUrl(input);
  if (!url) return null;
  return { ...progress, [itemId]: { ...current, certificateUrl: url } };
}

/** How many of the plan's items are marked done (ignores ids not in the plan). */
export function countDone(progress: PathwayProgress, itemIds: readonly string[]): number {
  return [...new Set(itemIds)].filter((id) => id in progress).length;
}
