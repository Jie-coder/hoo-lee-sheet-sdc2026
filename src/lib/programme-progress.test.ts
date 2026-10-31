import { afterEach, describe, expect, it } from "vitest";
import {
  countDone,
  loadProgress,
  normalizeCertificateUrl,
  progressStorageKey,
  saveProgress,
  setCertificateUrl,
  setCompleted,
  setVerification,
  verifiedItemIds,
} from "./programme-progress";

const NOW = new Date("2026-10-31T00:00:00.000Z");

afterEach(() => localStorage.clear());

describe("normalizeCertificateUrl", () => {
  it("accepts http(s) URLs and trims", () => {
    expect(normalizeCertificateUrl("  https://www.coursera.org/account/accomplishments/verify/ABC  ")).toBe(
      "https://www.coursera.org/account/accomplishments/verify/ABC",
    );
    expect(normalizeCertificateUrl("http://example.com/c")).toBe("http://example.com/c");
  });

  it("rejects other schemes, junk and empty input", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com/a", "coursera.org/x", "not a url", "", "   "]) {
      expect(normalizeCertificateUrl(bad)).toBeNull();
    }
  });
});

describe("storage", () => {
  it("round-trips per pathway key", () => {
    const progress = setCompleted({}, "c1", true, NOW);
    saveProgress("role-a", progress);
    expect(loadProgress("role-a")).toEqual(progress);
    expect(loadProgress("role-b")).toEqual({});
  });

  it("returns {} for corrupt or malformed data", () => {
    localStorage.setItem(progressStorageKey("r"), "{not json");
    expect(loadProgress("r")).toEqual({});
    localStorage.setItem(progressStorageKey("r"), JSON.stringify([1, 2]));
    expect(loadProgress("r")).toEqual({});
  });

  it("drops entries without a timestamp and non-http(s) certificate URLs on load", () => {
    localStorage.setItem(
      progressStorageKey("r"),
      JSON.stringify({
        a: { completedAt: "2026-01-01T00:00:00.000Z", certificateUrl: "javascript:alert(1)" },
        b: { certificateUrl: "https://x.com" },
        c: "yes",
      }),
    );
    expect(loadProgress("r")).toEqual({ a: { completedAt: "2026-01-01T00:00:00.000Z" } });
  });

  it("removes the key when progress becomes empty", () => {
    saveProgress("r", setCompleted({}, "c1", true, NOW));
    saveProgress("r", {});
    expect(localStorage.getItem(progressStorageKey("r"))).toBeNull();
  });

  it("is a safe no-op without window (SSR)", () => {
    const original = globalThis.window;
    // @ts-expect-error simulate the server
    delete globalThis.window;
    try {
      expect(loadProgress("r")).toEqual({});
      expect(() => saveProgress("r", { a: { completedAt: "x" } })).not.toThrow();
    } finally {
      globalThis.window = original;
    }
  });
});

describe("setCompleted / setCertificateUrl", () => {
  it("marks and unmarks, unmarking drops the certificate", () => {
    let progress = setCompleted({}, "c1", true, NOW);
    expect(progress.c1.completedAt).toBe(NOW.toISOString());
    progress = setCertificateUrl(progress, "c1", "https://example.com/cert")!;
    expect(progress.c1.certificateUrl).toBe("https://example.com/cert");
    expect(setCompleted(progress, "c1", true, new Date())).toBe(progress);
    expect(setCompleted(progress, "c1", false)).toEqual({});
  });

  it("rejects invalid URLs and URLs for items that aren't done", () => {
    const progress = setCompleted({}, "c1", true, NOW);
    expect(setCertificateUrl(progress, "c1", "javascript:alert(1)")).toBeNull();
    expect(setCertificateUrl({}, "c1", "https://example.com")).toBeNull();
  });

  it("clears the certificate when given empty text", () => {
    let progress = setCompleted({}, "c1", true, NOW);
    progress = setCertificateUrl(progress, "c1", "https://example.com/cert")!;
    expect(setCertificateUrl(progress, "c1", "  ")).toEqual({ c1: { completedAt: NOW.toISOString() } });
  });
});

describe("countDone", () => {
  it("counts only plan items that are done", () => {
    let progress = setCompleted({}, "c1", true, NOW);
    progress = setCompleted(progress, "p1", true, NOW);
    progress = setCompleted(progress, "stale", true, NOW);
    expect(countDone(progress, ["c1", "c2", "p1"])).toBe(2);
    expect(countDone(progress, ["c1", "c1"])).toBe(1);
    expect(countDone({}, ["c1"])).toBe(0);
    expect(countDone(progress, [])).toBe(0);
  });
});

describe("verification", () => {
  const URL_A = "https://www.coursera.org/account/accomplishments/verify/ABC";
  const verdict = { status: "verified" as const, reason: "Looks right.", checkedAt: NOW.toISOString(), matchedTitle: "Course A" };

  function withLink() {
    return setCertificateUrl(setCompleted({}, "c1", true, NOW), "c1", URL_A)!;
  }

  it("stores a verdict for the saved link and lists verified items", () => {
    const progress = setVerification(withLink(), "c1", URL_A, verdict);
    expect(progress.c1.verification).toEqual(verdict);
    expect(verifiedItemIds(progress)).toEqual(["c1"]);
  });

  it("does not count failed or pending verdicts", () => {
    const failed = setVerification(withLink(), "c1", URL_A, { ...verdict, status: "failed" });
    const pending = setVerification(withLink(), "c1", URL_A, { ...verdict, status: "pending" });
    expect(verifiedItemIds(failed)).toEqual([]);
    expect(verifiedItemIds(pending)).toEqual([]);
  });

  it("ignores a verdict for a link that has since changed", () => {
    const progress = setCertificateUrl(withLink(), "c1", "https://example.com/other")!;
    expect(setVerification(progress, "c1", URL_A, verdict)).toBe(progress);
  });

  it("clears the verdict when the link changes or is removed, keeps it for the same link", () => {
    const verified = setVerification(withLink(), "c1", URL_A, verdict);
    expect(setCertificateUrl(verified, "c1", URL_A)!.c1.verification).toEqual(verdict);
    expect(setCertificateUrl(verified, "c1", "https://example.com/other")!.c1.verification).toBeUndefined();
    expect(setCertificateUrl(verified, "c1", "")!.c1.verification).toBeUndefined();
  });

  it("round-trips through storage and sanitizes bad verdicts on load", () => {
    saveProgress("role-1", setVerification(withLink(), "c1", URL_A, verdict));
    expect(loadProgress("role-1").c1.verification).toEqual(verdict);

    localStorage.setItem(
      progressStorageKey("role-2"),
      JSON.stringify({
        a: { completedAt: NOW.toISOString(), certificateUrl: URL_A, verification: { status: "great", checkedAt: NOW.toISOString() } },
        b: { completedAt: NOW.toISOString(), certificateUrl: URL_A, verification: { status: "verified", checkedAt: "nope" } },
        c: { completedAt: NOW.toISOString(), verification: verdict },
        d: { completedAt: NOW.toISOString(), certificateUrl: URL_A, verification: { status: "failed", checkedAt: NOW.toISOString(), reason: 5 } },
      }),
    );
    const loaded = loadProgress("role-2");
    expect(loaded.a.verification).toBeUndefined();
    expect(loaded.b.verification).toBeUndefined();
    expect(loaded.c.verification).toBeUndefined();
    expect(loaded.d.verification).toEqual({ status: "failed", checkedAt: NOW.toISOString() });
  });
});
