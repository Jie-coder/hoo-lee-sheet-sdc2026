import { describe, expect, it, vi } from "vitest";
import {
  callWithQuotaRetry,
  EmbeddingQuotaExceededError,
  parseGoogleQuotaError,
  RETRY_MARGIN_SECONDS,
} from "./embedding-quota";

/** Shape close enough to an AI SDK APICallError for parseGoogleQuotaError / callWithQuotaRetry to read. */
function rateLimitError(options: { retryDelay?: string; quotaId?: string; message?: string } = {}) {
  const details: Record<string, unknown>[] = [];
  if (options.retryDelay) {
    details.push({ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: options.retryDelay });
  }
  if (options.quotaId) {
    details.push({
      "@type": "type.googleapis.com/google.rpc.QuotaFailure",
      violations: [{ quotaId: options.quotaId, quotaMetric: options.quotaId }],
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

describe("parseGoogleQuotaError", () => {
  it("returns null for a non-429 error", () => {
    expect(parseGoogleQuotaError(new Error("boom"))).toBeNull();
  });

  it("returns null for a 429-shaped value with no statusCode", () => {
    expect(parseGoogleQuotaError({ message: "nope" })).toBeNull();
  });

  it("reads the structured RetryInfo.retryDelay from the response body", () => {
    const info = parseGoogleQuotaError(rateLimitError({ retryDelay: "51.48s" }));
    expect(info).toEqual({ retryDelaySeconds: 51.48, isDaily: false });
  });

  it("falls back to parsing 'Please retry in Ns' from the message when there is no structured detail", () => {
    const error = new Error(
      "Quota exceeded for metric: embed_content_free_tier_requests, limit: 100, model: gemini-embedding-1.0. Please retry in 51.48s."
    ) as Error & { statusCode: number };
    error.statusCode = 429;
    const info = parseGoogleQuotaError(error);
    expect(info).toEqual({ retryDelaySeconds: 51.48, isDaily: false });
  });

  it("flags a quotaId/quotaMetric containing PerDay as a daily (non-recoverable) quota", () => {
    const info = parseGoogleQuotaError(rateLimitError({ retryDelay: "3600s", quotaId: "GenerateContentPerDayPerProjectPerModel" }));
    expect(info).toEqual({ retryDelaySeconds: 3600, isDaily: true });
  });

  it("flags 'per day' in the message text even with no structured details", () => {
    const error = new Error("Quota exceeded: daily limit (per day) reached for this project.") as Error & {
      statusCode: number;
    };
    error.statusCode = 429;
    expect(parseGoogleQuotaError(error)?.isDaily).toBe(true);
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
