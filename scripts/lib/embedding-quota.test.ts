import { describe, expect, it, vi } from "vitest";
import {
  callWithQuotaRetry,
  EmbeddingQuotaExceededError,
  formatQuotaLogLine,
  parseGoogleQuotaError,
  RETRY_MARGIN_SECONDS,
  sanitizeForLog,
  type Logger,
} from "./embedding-quota";

/** Shape close enough to an AI SDK APICallError for parseGoogleQuotaError / callWithQuotaRetry to read. */
function rateLimitError(
  options: { retryDelay?: string; quotaId?: string; quotaValue?: number; message?: string } = {}
) {
  const details: Record<string, unknown>[] = [];
  if (options.retryDelay) {
    details.push({ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: options.retryDelay });
  }
  if (options.quotaId) {
    details.push({
      "@type": "type.googleapis.com/google.rpc.QuotaFailure",
      violations: [{ quotaId: options.quotaId, quotaMetric: options.quotaId, quotaValue: options.quotaValue }],
    });
  }
  const error = new Error(
    options.message ??
      "Quota exceeded for metric: generativelanguage.googleapis.com/embed_content_free_tier_requests, limit: 100, model: gemini-embedding-1.0."
  ) as Error & { statusCode: number; responseBody: string };
  error.statusCode = 429;
  error.responseBody = JSON.stringify({ error: { code: 429, message: error.message, status: "RESOURCE_EXHAUSTED", details } });
  return error;
}

/** Captures logged lines instead of touching the real console. */
function fakeLogger(): Logger & { lines: { log: string[]; error: string[] } } {
  const lines = { log: [] as string[], error: [] as string[] };
  return {
    lines,
    log: (message: string) => lines.log.push(message),
    error: (message: string) => lines.error.push(message),
  };
}

describe("parseGoogleQuotaError", () => {
  it("returns null for a non-429 error", () => {
    expect(parseGoogleQuotaError(new Error("boom"))).toBeNull();
  });

  it("returns null for a 429-shaped value with no statusCode", () => {
    expect(parseGoogleQuotaError({ message: "nope" })).toBeNull();
  });

  it("reads the structured RetryInfo.retryDelay from the response body", () => {
    const info = parseGoogleQuotaError(rateLimitError({ retryDelay: "51.48s" }));
    expect(info).toMatchObject({ retryDelaySeconds: 51.48, isDaily: false });
  });

  it("falls back to parsing 'Please retry in Ns' from the message when there is no structured detail", () => {
    const error = new Error(
      "Quota exceeded for metric: embed_content_free_tier_requests, limit: 100, model: gemini-embedding-1.0. Please retry in 51.48s."
    ) as Error & { statusCode: number };
    error.statusCode = 429;
    const info = parseGoogleQuotaError(error);
    expect(info).toMatchObject({ retryDelaySeconds: 51.48, isDaily: false });
  });

  it("flags a quotaId/quotaMetric containing PerDay as a daily (non-recoverable) quota", () => {
    const info = parseGoogleQuotaError(rateLimitError({ retryDelay: "3600s", quotaId: "GenerateContentPerDayPerProjectPerModel" }));
    expect(info).toMatchObject({ retryDelaySeconds: 3600, isDaily: true });
  });

  it("flags 'per day' in the message text even with no structured details", () => {
    const error = new Error("Quota exceeded: daily limit (per day) reached for this project.") as Error & {
      statusCode: number;
    };
    error.statusCode = 429;
    expect(parseGoogleQuotaError(error)?.isDaily).toBe(true);
  });

  it("reads quotaMetric/quotaValue from the structured QuotaFailure violation", () => {
    const info = parseGoogleQuotaError(
      rateLimitError({ retryDelay: "10s", quotaId: "GenerateRequestsPerMinutePerProjectPerModel", quotaValue: 100 })
    );
    expect(info).toMatchObject({ quotaMetric: "GenerateRequestsPerMinutePerProjectPerModel", quotaLimit: 100 });
  });

  it("falls back to parsing 'Quota exceeded for metric: X, limit: N' from the message text", () => {
    const error = new Error(
      "Quota exceeded for metric: generativelanguage.googleapis.com/embed_content_free_tier_requests, limit: 100, model: gemini-embedding-1.0."
    ) as Error & { statusCode: number };
    error.statusCode = 429;
    const info = parseGoogleQuotaError(error);
    expect(info).toMatchObject({
      quotaMetric: "generativelanguage.googleapis.com/embed_content_free_tier_requests",
      quotaLimit: 100,
    });
  });
});

describe("formatQuotaLogLine / sanitizeForLog", () => {
  it("contains the metric, limit, and retry delay", () => {
    const line = formatQuotaLogLine({
      retryDelaySeconds: 51.48,
      isDaily: false,
      quotaMetric: "embed_content_free_tier_requests",
      quotaLimit: 100,
    });
    expect(line).toContain("embed_content_free_tier_requests");
    expect(line).toContain("100");
    expect(line).toContain("51.48s");
  });

  it("never contains an API key or a key= query parameter", () => {
    const dirty = "fetch failed: https://generativelanguage.googleapis.com/v1/models?key=AIzaSyFAKEKEY1234567890 500";
    const clean = sanitizeForLog(dirty);
    expect(clean).not.toContain("key=AIzaSyFAKEKEY1234567890");
    expect(clean).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/);
  });
});

describe("callWithQuotaRetry", () => {
  it("waits the parsed retry delay plus the margin, then retries, on a recoverable 429", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const result = await callWithQuotaRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) throw rateLimitError({ retryDelay: "10s" });
        return "ok";
      },
      { sleep }
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith((10 + RETRY_MARGIN_SECONDS) * 1000);
  });

  it("logs one line per 429 with the metric, limit, and retry delay, and never the API key or a key= URL", async () => {
    const sleep = vi.fn(async () => {});
    const logger = fakeLogger();
    let attempts = 0;
    await callWithQuotaRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw rateLimitError({
            retryDelay: "10s",
            quotaId: "GenerateRequestsPerMinutePerProjectPerModel",
            quotaValue: 100,
            message:
              "Quota exceeded for metric: generativelanguage.googleapis.com/embed_content_free_tier_requests, " +
              "limit: 100, model: gemini-embedding-1.0. Please retry in 10s. See https://x.test/?key=AIzaSyFAKEKEY1234567890",
          });
        }
        return "ok";
      },
      { sleep, logger }
    );

    expect(logger.lines.error).toHaveLength(1);
    const line = logger.lines.error[0];
    expect(line).toContain("GenerateRequestsPerMinutePerProjectPerModel");
    expect(line).toContain("100");
    expect(line).toContain("10s");
    expect(line).not.toContain("AIzaSyFAKEKEY1234567890");
    expect(line).not.toMatch(/key=[^R]/);
    expect(logger.lines.log).toHaveLength(0);
  });

  it("stops after maxRetries recoverable 429s, throwing EmbeddingQuotaExceededError", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    await expect(
      callWithQuotaRetry(
        async () => {
          attempts += 1;
          throw rateLimitError({ retryDelay: "1s" });
        },
        { sleep, maxRetries: 2 }
      )
    ).rejects.toThrow(EmbeddingQuotaExceededError);
    expect(attempts).toBe(3); // the initial attempt + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("stops immediately (no sleep, no retry) on a daily quota", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    await expect(
      callWithQuotaRetry(
        async () => {
          attempts += 1;
          throw rateLimitError({ retryDelay: "3600s", quotaId: "GenerateContentPerDayPerProjectPerModel" });
        },
        { sleep }
      )
    ).rejects.toThrow(EmbeddingQuotaExceededError);
    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("lets a non-429 error propagate unchanged, without retrying", async () => {
    const sleep = vi.fn(async () => {});
    const error = new Error("network down");
    await expect(callWithQuotaRetry(async () => { throw error; }, { sleep })).rejects.toBe(error);
    expect(sleep).not.toHaveBeenCalled();
  });
});
