// Self-reported programme/course completion, stored only in this browser's
// localStorage (one entry per chosen role's pathway). A certificate URL is a
// link the learner pasted; the learner can ask for an AI-assisted check of it
// (POST /api/verify-certificate), and the verdict is saved next to the link.
// The check is not accreditation (docs/programme-proof.md).
import type { VerificationStatus } from "@/lib/verify-certificate";

export type StepVerification = {
  status: VerificationStatus;
  reason?: string;
  /** ISO timestamp of the check. */
  checkedAt: string;
  matchedTitle?: string;
};

export type StepProgress = {
  /** ISO timestamp of when the learner marked the step done. */
  completedAt: string;
  /** Optional http(s) link the learner pasted as proof. */
  certificateUrl?: string;
  /** AI-assisted check of certificateUrl. Cleared whenever the URL changes. */
  verification?: StepVerification;
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

const STATUSES: readonly VerificationStatus[] = ["verified", "failed", "pending"];

function sanitizeVerification(value: unknown): StepVerification | null {
  if (!value || typeof value !== "object") return null;
  const { status, reason, checkedAt, matchedTitle } = value as Record<string, unknown>;
  if (typeof status !== "string" || !STATUSES.includes(status as VerificationStatus)) return null;
  if (typeof checkedAt !== "string" || Number.isNaN(Date.parse(checkedAt))) return null;
  return {
    status: status as VerificationStatus,
    checkedAt,
    ...(typeof reason === "string" && reason ? { reason: reason.slice(0, 300) } : {}),
    ...(typeof matchedTitle === "string" && matchedTitle ? { matchedTitle: matchedTitle.slice(0, 200) } : {}),
  };
}

function sanitize(value: unknown): PathwayProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: PathwayProgress = {};
  for (const [itemId, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object") continue;
    const { completedAt, certificateUrl, verification } = entry as Record<string, unknown>;
    if (typeof completedAt !== "string") continue;
    const url = typeof certificateUrl === "string" ? normalizeCertificateUrl(certificateUrl) : null;
    // A verdict only makes sense next to the link it was run on.
    const checked = url ? sanitizeVerification(verification) : null;
    out[itemId] = url ? { completedAt, certificateUrl: url, ...(checked ? { verification: checked } : {}) } : { completedAt };
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
  // Same link keeps its verdict; a different link needs a fresh check.
  if (url === current.certificateUrl) return progress;
  return { ...progress, [itemId]: { completedAt: current.completedAt, certificateUrl: url } };
}

/**
 * Saves a check result for the item's link. Ignored (returns the same progress)
 * when the item is gone or its link changed while the check was running.
 */
export function setVerification(
  progress: PathwayProgress,
  itemId: string,
  checkedUrl: string,
  verification: StepVerification,
): PathwayProgress {
  const current = progress[itemId];
  if (!current || current.certificateUrl !== checkedUrl) return progress;
  return { ...progress, [itemId]: { ...current, verification } };
}

/** Ids of done items whose certificate link passed the AI-assisted check. */
export function verifiedItemIds(progress: PathwayProgress): string[] {
  return Object.entries(progress)
    .filter(([, step]) => step.certificateUrl && step.verification?.status === "verified")
    .map(([itemId]) => itemId);
}

/** How many of the plan's items are marked done (ignores ids not in the plan). */
export function countDone(progress: PathwayProgress, itemIds: readonly string[]): number {
  return [...new Set(itemIds)].filter((id) => id in progress).length;
}
