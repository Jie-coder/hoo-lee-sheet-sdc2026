// Parses Gemini/Google Generative AI 429 responses and retries the
// recoverable ones. Deliberately has no @ai-sdk/* or @supabase/supabase-js
// import: apply.ts (loaded for every run, including a dry run) needs
// EmbeddingQuotaExceededError to catch it by `instanceof`, so this module
// must stay free of the Gemini SDK import that --apply alone pulls in.

/**
 * Thrown by an Embedder when a 429 cannot be recovered from on its own: a
 * per-day quota, or rate-limit retries exhausted. Callers (apply.ts) must
 * stop embedding rather than treat this like any other failure, and report
 * how far they got so a rerun can resume.
 */
export class EmbeddingQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingQuotaExceededError";
  }
}

export type GoogleQuotaErrorInfo = {
  /** Seconds Google said to wait, from the RetryInfo detail or the "Please retry in Ns" message text. Null when neither is present. */
  retryDelaySeconds: number | null;
  /** True when the violated quota is a daily cap (quotaId/quotaMetric or the message mentions "PerDay"/"per day"): waiting and retrying cannot help today. */
  isDaily: boolean;
};

type ApiErrorLike = {
  statusCode?: number;
  message?: string;
  responseBody?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** "51s" / "51.48s" -> seconds. Google's RetryInfo.retryDelay is a protobuf Duration string. */
function parseDurationString(value: string): number | null {
  const match = /^([\d.]+)s$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Parses a Google Generative AI 429 (an AI SDK APICallError, or anything
 * with the same statusCode/message/responseBody shape) into retry guidance.
 * Returns null when `error` isn't a Google rate-limit error at all, so the
 * caller can let anything else propagate as a normal failure.
 *
 * Reads the structured error details first — RetryInfo's retryDelay and
 * QuotaFailure's violations, both under error.details in the raw JSON body —
 * falling back to the "Please retry in Ns" message text and a "PerDay"/"per
 * day" substring check when structured details are absent. We parse
 * responseBody ourselves rather than relying on the AI SDK's already-parsed
 * error data, since that shape is provider-internal and could change.
 */
export function parseGoogleQuotaError(error: unknown): GoogleQuotaErrorInfo | null {
  const err = error as ApiErrorLike | null;
  if (!err || typeof err !== "object" || err.statusCode !== 429) return null;

  let retryDelaySeconds: number | null = null;
  let isDaily = false;

  const bodyText = err.responseBody ?? "";
  let parsedBody: unknown = null;
  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsedBody = null;
  }

  const details = asRecord(asRecord(parsedBody)?.error)?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const d = asRecord(detail);
      if (!d) continue;
      if (typeof d.retryDelay === "string") {
        const seconds = parseDurationString(d.retryDelay);
        if (seconds != null) retryDelaySeconds = seconds;
      }
      if (Array.isArray(d.violations)) {
        for (const violation of d.violations) {
          const v = asRecord(violation);
          const quotaId = String(v?.quotaId ?? "");
          const quotaMetric = String(v?.quotaMetric ?? "");
          if (/per ?day/i.test(quotaId) || /per ?day/i.test(quotaMetric)) isDaily = true;
        }
      }
    }
  }

  const haystack = `${err.message ?? ""} ${bodyText}`;
  if (retryDelaySeconds == null) {
    const match = /retry in ([\d.]+)\s*s/i.exec(haystack);
    if (match) retryDelaySeconds = Number(match[1]);
  }
  if (!isDaily && /per ?day/i.test(haystack)) isDaily = true;

  return { retryDelaySeconds, isDaily };
}

/** Bounded retries for a recoverable (per-minute) 429: enough to ride out a burst without hanging forever on a misbehaving quota. */
export const MAX_RATE_LIMIT_RETRIES = 5;

/** Added to Google's own retryDelay so a request issued right at the boundary doesn't land a few ms early and get 429'd again. */
export const RETRY_MARGIN_SECONDS = 2;

/** Used only when a 429 has no parseable retry delay at all. */
export const DEFAULT_RETRY_SECONDS = 20;

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `attempt`, retrying a recoverable Google 429 (per `parseGoogleQuotaError`)
 * after waiting its retry delay plus RETRY_MARGIN_SECONDS. Throws
 * EmbeddingQuotaExceededError — instead of retrying forever — once the quota
 * is a daily cap, or once maxRetries recoverable attempts are exhausted.
 * Anything else (including a non-429 error) propagates unchanged.
 */
export async function callWithQuotaRetry<T>(
  attempt: () => Promise<T>,
  options: { maxRetries?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RATE_LIMIT_RETRIES;
  const sleep = options.sleep ?? defaultSleep;

  for (let attemptNumber = 0; ; attemptNumber += 1) {
    try {
      return await attempt();
    } catch (error) {
      const quota = parseGoogleQuotaError(error);
      if (!quota) throw error;

      const message = error instanceof Error ? error.message : String(error);
      if (quota.isDaily) {
        throw new EmbeddingQuotaExceededError(`Gemini daily embedding quota exceeded: ${message}`);
      }
      if (attemptNumber >= maxRetries) {
        throw new EmbeddingQuotaExceededError(
          `Gemini embedding rate limit: retries exhausted after ${attemptNumber + 1} attempt(s): ${message}`
        );
      }
      const waitSeconds = (quota.retryDelaySeconds ?? DEFAULT_RETRY_SECONDS) + RETRY_MARGIN_SECONDS;
      await sleep(waitSeconds * 1000);
    }
  }
}
