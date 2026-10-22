import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCv, type ParsedCvResult } from "@/lib/parse-cv";

const noopSleep = async () => {};

const SAMPLE_RESULT: ParsedCvResult = {
  name: "Demo Person",
  roles: [{ title: "Demo Role", years: 1, tasks: [] }],
  education: [{ level: "Demo Diploma", field: "Demo Polytechnic" }],
  skills: [{ label: "use spreadsheets software", matched: true }],
};

const ORIGINAL_AI_MOCK = process.env.AI_MOCK;

afterEach(() => {
  if (ORIGINAL_AI_MOCK === undefined) delete process.env.AI_MOCK;
  else process.env.AI_MOCK = ORIGINAL_AI_MOCK;
});

describe("parseCv", () => {
  it("returns the precomputed result for a sha256 hit, without calling the AI pipeline", async () => {
    const bytes = new TextEncoder().encode("whatever bytes, only the hash is checked");
    const hashHex = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    const extractPdfText = vi.fn();
    const extractCv = vi.fn();

    const outcome = await parseCv(bytes, {
      demoResults: { [hashHex]: SAMPLE_RESULT },
      sleep: noopSleep,
      extractPdfText,
      extractCv,
    });

    expect(outcome).toEqual({ ok: true, result: SAMPLE_RESULT });
    expect(extractPdfText).not.toHaveBeenCalled();
    expect(extractCv).not.toHaveBeenCalled();
  });

  it("falls through to the normal path when the sha256 does not match any demo CV", async () => {
    const bytes = new TextEncoder().encode("a CV nobody has precomputed");
    const extractPdfText = vi.fn(async () => "Name: Someone\nSkills: use spreadsheets software");
    const extractCv = vi.fn(async () => ({ skills: ["use spreadsheets software"], roles: [], education: [] }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome.ok).toBe(true);
    expect(extractPdfText).toHaveBeenCalledTimes(1);
    expect(extractCv).toHaveBeenCalledTimes(1);
  });

  it("returns the AI_MOCK fixture when AI_MOCK=true, without reading the PDF", async () => {
    process.env.AI_MOCK = "true";
    const bytes = new TextEncoder().encode("some CV");
    const extractPdfText = vi.fn();

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText });

    expect(outcome.ok).toBe(true);
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("returns 422 for a CV with no extractable text (a scanned PDF)", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("scanned image, no text layer");
    const extractPdfText = vi.fn(async () => "   ");
    const extractCv = vi.fn();

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome).toEqual({ ok: false, status: 422, error: "Scanned PDFs are not supported." });
    expect(extractCv).not.toHaveBeenCalled();
  });

  it("returns 500 with a readable message when the Gemini extraction call fails", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("a CV");
    const extractPdfText = vi.fn(async () => "some text");
    const extractCv = vi.fn(async () => {
      throw new Error("model is overloaded");
    });

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(500);
      expect(outcome.error).toContain("model is overloaded");
    }
  });

  it("maps the Gemini extraction's roles/education into ParsedCvRole/ParsedCvEducation shape", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("a CV");
    const extractPdfText = vi.fn(async () => "some text");
    const extractCv = vi.fn(async () => ({
      name: "Jane Doe",
      skills: [],
      roles: [{ title: "Clerk", years: 2 }],
      education: [{ qualification: "Diploma in Business", institution: "A Polytechnic" }],
    }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome).toEqual({
      ok: true,
      result: {
        name: "Jane Doe",
        roles: [{ title: "Clerk", years: 2, tasks: [] }],
        education: [{ level: "Diploma in Business", field: "A Polytechnic" }],
        skills: [],
      },
    });
  });
});
