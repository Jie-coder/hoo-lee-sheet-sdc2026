import { describe, expect, it } from "vitest";
import {
  DEMO_CERTIFICATE_REASON,
  DEMO_CERTIFICATE_URL,
  MAX_PAGE_TEXT_CHARS,
  buildVerificationPrompt,
  htmlToText,
  isBlockedHost,
  isDemoCertificateUrl,
  mockVerdict,
  parsePublicHttpUrl,
  parseVerificationResponse,
} from "./verify-certificate";

const AT = "2026-10-31T00:00:00.000Z";

describe("parsePublicHttpUrl / isBlockedHost", () => {
  it("accepts public http(s) URLs", () => {
    expect(parsePublicHttpUrl("https://www.coursera.org/verify/ABC")?.hostname).toBe("www.coursera.org");
    expect(parsePublicHttpUrl("http://example.com/c")).not.toBeNull();
  });

  it("rejects other schemes, junk and credentials", () => {
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "ftp://x.com/a", "nope", "", "https://user:pw@example.com/"]) {
      expect(parsePublicHttpUrl(bad)).toBeNull();
    }
  });

  it("blocks localhost, private, link-local and internal hosts", () => {
    for (const bad of [
      "http://localhost/x",
      "http://app.localhost/x",
      "http://127.0.0.1/x",
      "http://127.8.8.8/x",
      "http://10.1.2.3/x",
      "http://172.16.0.1/x",
      "http://172.31.255.1/x",
      "http://192.168.1.1/x",
      "http://169.254.169.254/latest/meta-data",
      "http://0.0.0.0/x",
      "http://[::1]/x",
      "http://[fd00::1]/x",
      "http://[fe80::1]/x",
      "http://[::ffff:127.0.0.1]/x",
      "http://printer.local/x",
      "http://db.internal/x",
      "http://2130706433/x",
    ]) {
      expect(parsePublicHttpUrl(bad), bad).toBeNull();
    }
  });

  it("does not block public addresses that only look close to private ranges", () => {
    expect(isBlockedHost("172.15.0.1")).toBe(false);
    expect(isBlockedHost("172.32.0.1")).toBe(false);
    expect(isBlockedHost("8.8.8.8")).toBe(false);
    expect(isBlockedHost("local.example.com")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips scripts, styles, tags and entities, and keeps the title first", () => {
    const html =
      "<html><head><title>My &amp; Cert</title><style>.a{}</style></head><body><script>alert(1)</script><!-- hi --><h1>Certificate</h1><p>of   Completion&nbsp;for Ada</p></body></html>";
    expect(htmlToText(html)).toBe("Page title: My & Cert\nCertificate of Completion for Ada");
  });

  it("truncates to the cap", () => {
    expect(htmlToText(`<p>${"a".repeat(20000)}</p>`)).toHaveLength(MAX_PAGE_TEXT_CHARS);
  });
});

describe("buildVerificationPrompt", () => {
  it("includes the expected title, provider and page text, and warns about untrusted text", () => {
    const { system, prompt } = buildVerificationPrompt({
      expectedTitle: "Google Data Analytics",
      provider: "Coursera",
      certificateUrl: "https://example.com/c",
      pageText: "Ada completed it",
    });
    expect(system).toContain("untrusted");
    expect(system).toContain("JSON");
    expect(prompt).toContain("Google Data Analytics");
    expect(prompt).toContain("Coursera");
    expect(prompt).toContain("Ada completed it");
  });
});

describe("parseVerificationResponse", () => {
  it("verifies only when both judgements are true", () => {
    const ok = parseVerificationResponse(
      '{"looksLikeCertificate":true,"matchesExpectedTitle":true,"matchedTitle":"Data Analytics","reason":"Matches."}',
      AT,
    );
    expect(ok).toEqual({ ok: true, status: "verified", reason: "Matches.", matchedTitle: "Data Analytics", checkedAt: AT });

    const wrongCourse = parseVerificationResponse(
      '{"looksLikeCertificate":true,"matchesExpectedTitle":false,"matchedTitle":"Other","reason":"Different course."}',
      AT,
    );
    expect(wrongCourse).toEqual({ ok: false, status: "failed", reason: "Different course.", checkedAt: AT });
    expect(parseVerificationResponse('{"looksLikeCertificate":false,"matchesExpectedTitle":true}', AT)?.status).toBe("failed");
  });

  it("tolerates code fences and surrounding prose", () => {
    const result = parseVerificationResponse(
      'Sure:\n```json\n{"looksLikeCertificate":true,"matchesExpectedTitle":true,"matchedTitle":null,"reason":"ok"}\n```',
      AT,
    );
    expect(result?.status).toBe("verified");
    expect(result?.matchedTitle).toBeUndefined();
  });

  it("returns null for anything that is not the expected JSON", () => {
    for (const bad of ["", "no json", "{broken", '{"looksLikeCertificate":"yes","matchesExpectedTitle":true}', "[1]", '{"reason":"x"}']) {
      expect(parseVerificationResponse(bad, AT)).toBeNull();
    }
  });
});

describe("mockVerdict", () => {
  const verdict = (certificateUrl: string) => mockVerdict({ certificateUrl, expectedTitle: "Course A" }, AT);

  it("verifies a known provider with a certificate-style path", () => {
    for (const url of [
      "https://www.coursera.org/account/accomplishments/verify/ABC123",
      "https://credentials.edx.org/credentials/abc/",
      "https://www.udemy.com/certificate/UC-123/",
      "https://www.linkedin.com/learning/certificates/abc",
      "https://www.credly.com/badges/abc",
      "https://www.freecodecamp.org/certification/ada/responsive-web-design",
      "https://grow.google/certificates/",
    ]) {
      const result = verdict(url);
      expect(result.status, url).toBe("verified");
      expect(result.ok).toBe(true);
      expect(result.matchedTitle).toBe("Course A");
    }
  });

  it("fails an unknown host, a known host with a non-certificate path, and blocked URLs", () => {
    expect(verdict("https://example.com/certificate/abc").status).toBe("failed");
    expect(verdict("https://www.coursera.org/learn/some-course").status).toBe("failed");
    expect(verdict("https://notcoursera.org/verify/abc").status).toBe("failed");
    expect(verdict("http://localhost/verify").status).toBe("failed");
  });
});

describe("demo certificate URL", () => {
  const verified = (certificateUrl: string, expectedTitle: string) =>
    mockVerdict({ certificateUrl, expectedTitle }, AT);

  it("verifies the demo URL for a mismatched programme title and a Coursera course title", () => {
    for (const expectedTitle of ["AI untuk Rakyat Programme", "Google Data Analytics Professional Certificate"]) {
      expect(verified(DEMO_CERTIFICATE_URL, expectedTitle)).toEqual({
        ok: true,
        status: "verified",
        reason: DEMO_CERTIFICATE_REASON,
        matchedTitle: expectedTitle,
        checkedAt: AT,
      });
      expect(DEMO_CERTIFICATE_REASON).toBe("Demo certificate link (product demonstration only).");
    }
  });

  it("treats host and path as the same demo link after normal URL parsing", () => {
    for (const url of [
      `  ${DEMO_CERTIFICATE_URL}  `,
      "https://DEMO.laluan.app/example-certificate",
      "https://demo.laluan.app/example-certificate?ref=demo",
      "https://demo.laluan.app/example-certificate#preview",
    ]) {
      expect(isDemoCertificateUrl(url), url).toBe(true);
      expect(verified(url, "AI untuk Rakyat Programme").status, url).toBe("verified");
    }
  });

  it("does not treat lookalike links as the demo URL", () => {
    for (const url of [
      "http://demo.laluan.app/example-certificate",
      "https://demo.laluan.app/example-certificate/",
      "https://demo.laluan.app/example-certificate/extra",
      "https://www.demo.laluan.app/example-certificate",
      "https://demo.laluan.app.evil.example/example-certificate",
      "https://example.com/example-certificate",
    ]) {
      expect(isDemoCertificateUrl(url), url).toBe(false);
      const result = verified(url, "AI untuk Rakyat Programme");
      expect(result.status, url).toBe("failed");
      expect(result.reason).not.toBe(DEMO_CERTIFICATE_REASON);
    }
  });

  it("still fails a non-demo URL on title mismatch", () => {
    const mismatch = parseVerificationResponse(
      '{"looksLikeCertificate":true,"matchesExpectedTitle":false,"matchedTitle":"Other course","reason":"Different course."}',
      AT,
    );
    expect(mismatch).toEqual({ ok: false, status: "failed", reason: "Different course.", checkedAt: AT });

    const unknownHost = mockVerdict(
      { certificateUrl: "https://example.com/certificate/abc", expectedTitle: "AI untuk Rakyat Programme" },
      AT,
    );
    expect(unknownHost).toMatchObject({ ok: false, status: "failed" });
    expect(unknownHost.reason).not.toBe(DEMO_CERTIFICATE_REASON);

    const courseraWrongShape = mockVerdict(
      { certificateUrl: "https://www.coursera.org/learn/google-data-analytics", expectedTitle: "Google Data Analytics Professional Certificate" },
      AT,
    );
    expect(courseraWrongShape.status).toBe("failed");
  });
});
