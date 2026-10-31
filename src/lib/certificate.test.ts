import { afterEach, describe, expect, it } from "vitest";
import {
  CERTIFICATE_NAME_KEY,
  cleanLearnerName,
  formatCertificateDate,
  loadCertificateName,
  saveCertificateName,
  verifiedCourseTitles,
} from "./certificate";

afterEach(() => localStorage.clear());

describe("formatCertificateDate", () => {
  it("formats as DD Mon YYYY", () => {
    expect(formatCertificateDate(new Date(2026, 9, 31))).toBe("31 Oct 2026");
    expect(formatCertificateDate(new Date(2026, 8, 5))).toBe("05 Sep 2026");
  });
});

describe("learner name", () => {
  it("cleans whitespace and caps length", () => {
    expect(cleanLearnerName("  Ada   Lovelace \n")).toBe("Ada Lovelace");
    expect(cleanLearnerName("x".repeat(300))).toHaveLength(120);
  });

  it("round-trips through localStorage and treats blank as missing", () => {
    expect(loadCertificateName()).toBeNull();
    saveCertificateName("  Siti  Aminah ");
    expect(loadCertificateName()).toBe("Siti Aminah");
    localStorage.setItem(CERTIFICATE_NAME_KEY, "   ");
    expect(loadCertificateName()).toBeNull();
  });
});

describe("verifiedCourseTitles", () => {
  it("maps ids to titles and skips unknown ids", () => {
    expect(verifiedCourseTitles(["a", "zzz", "b"], { a: "Course A", b: "Course B" })).toEqual(["Course A", "Course B"]);
  });
});
