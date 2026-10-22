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

  it("returns 422 when the PDF itself cannot be read (corrupt file)", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("not actually a valid PDF");
    const extractPdfText = vi.fn(async () => {
      throw new Error("bad XRef entry");
    });
    const extractCv = vi.fn();

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome).toEqual({ ok: false, status: 422, error: "Could not read that PDF." });
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
      roles: [{ title: "Clerk", years: 2, tasks: [] }],
      education: [{ qualification: "Diploma in Business", field: "Business Administration" }],
    }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome).toEqual({
      ok: true,
      result: {
        name: "Jane Doe",
        roles: [{ title: "Clerk", years: 2, tasks: [] }],
        education: [{ level: "Diploma in Business", field: "Business Administration" }],
        skills: [],
      },
    });
  });

  it("keeps a task whose evidence quote is found verbatim in the CV text", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("a CV");
    const cvText = "Processed weekly payroll for 40 staff.\nFiled expense reports monthly.";
    const extractPdfText = vi.fn(async () => cvText);
    const extractCv = vi.fn(async () => ({
      skills: [],
      roles: [
        {
          title: "Admin Assistant",
          years: 1,
          tasks: [{ text: "Processed weekly payroll", evidence: "Processed weekly payroll for 40 staff" }],
        },
      ],
      education: [],
    }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.roles).toEqual([{ title: "Admin Assistant", years: 1, tasks: ["Processed weekly payroll"] }]);
    }
  });

  it("drops a task whose evidence quote is not found anywhere in the CV text (paraphrased or fabricated)", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("a CV");
    const cvText = "Processed weekly payroll for 40 staff.";
    const extractPdfText = vi.fn(async () => cvText);
    const extractCv = vi.fn(async () => ({
      skills: [],
      roles: [
        {
          title: "Admin Assistant",
          years: 1,
          tasks: [
            { text: "Processed weekly payroll", evidence: "Processed weekly payroll for 40 staff" },
            { text: "Managed the entire IT department", evidence: "Managed the entire IT department" },
          ],
        },
      ],
      education: [],
    }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.roles).toEqual([{ title: "Admin Assistant", years: 1, tasks: ["Processed weekly payroll"] }]);
    }
  });

  it("matches evidence across curly quotes, dash variants, letter case, and line-wrapped whitespace", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("a CV");
    // CV text uses a plain quote/hyphen and wraps across a line break.
    const cvText = 'Led a cross-functional team\nto deliver the "Q1 launch" two weeks early.';
    const extractPdfText = vi.fn(async () => cvText);
    const extractCv = vi.fn(async () => ({
      skills: [],
      roles: [
        {
          title: "Project Lead",
          years: 3,
          tasks: [
            {
              text: "Delivered the Q1 launch early",
              // Evidence quote comes back with curly quotes and an en dash, and no line break.
              evidence: "LED A CROSS–FUNCTIONAL TEAM to deliver the “Q1 launch” two weeks early.",
            },
          ],
        },
      ],
      education: [],
    }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.roles[0].tasks).toEqual(["Delivered the Q1 launch early"]);
    }
  });
});
