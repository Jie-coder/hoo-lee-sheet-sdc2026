import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";

// defaultExtractCv calls generateObject. Tests that exercise that path must
// not hit a live provider (including the sponsor endpoint).
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: vi.fn() };
});

import { generateObject } from "ai";
import { resetProviderLogForTests } from "@/lib/ai";
import { parseCv, capCvExtraction, CvExtractionSchema, CV_EXTRACTION_LIMITS, type ParsedCvResult } from "@/lib/parse-cv";
import { z } from "zod";

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

  it("matches an evidence quote that spans a tab-indented line break in the CV text, regardless of case", async () => {
    process.env.AI_MOCK = "false";
    const bytes = new TextEncoder().encode("a CV");
    // CV text wraps the quote across a line break with a tab-indented continuation.
    const cvText = "Reconciled monthly accounts\n\tfor three regional offices.";
    const extractPdfText = vi.fn(async () => cvText);
    const extractCv = vi.fn(async () => ({
      skills: [],
      roles: [
        {
          title: "Accounts Clerk",
          years: 2,
          tasks: [
            {
              text: "Reconciled accounts for three offices",
              evidence: "RECONCILED MONTHLY ACCOUNTS for three regional offices",
            },
          ],
        },
      ],
      education: [],
    }));

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.roles[0].tasks).toEqual(["Reconciled accounts for three offices"]);
    }
  });
});

describe("parsed skill dedupe", () => {
  it("dedupes skills that map to the same ESCO skill, and free text by normalized label", async () => {
    const { dedupeParsedSkills } = await import("@/lib/parse-cv");
    expect(
      dedupeParsedSkills([
        { label: "use spreadsheets software", matched: true },
        { label: "Excel", matched: false },
        { label: "use spreadsheets software", matched: true },
        { label: "  excel ", matched: false },
        { label: "Use  Spreadsheets Software", matched: false },
      ]),
    ).toEqual([
      { label: "use spreadsheets software", matched: true },
      { label: "Excel", matched: false },
      { label: "Use  Spreadsheets Software", matched: false },
    ]);
  });

  it("returns no duplicate skills from the real pipeline when raw labels resolve to one ESCO id", async () => {
    const bytes = new TextEncoder().encode("a CV with repeated skills");
    const extractPdfText = vi.fn(async () => "Skills: spreadsheets");
    const extractCv = vi.fn(async () => ({
      skills: ["use spreadsheets software", "Use Spreadsheets Software (advanced)", "Basket weaving", "basket weaving"],
      roles: [],
      education: [],
    }));
    const embedTexts = vi.fn(async () => {
      throw new Error("no embeddings in tests");
    });

    const outcome = await parseCv(bytes, { demoResults: {}, sleep: noopSleep, extractPdfText, extractCv, embedTexts });

    expect(outcome.ok && outcome.result.skills).toEqual([
      { label: "use spreadsheets software", matched: true },
      { label: "Basket weaving", matched: false },
    ]);
  });

  it("dedupes skills on a demo sha256 hit too", async () => {
    const bytes = new TextEncoder().encode("demo bytes with dup skills");
    const hashHex = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
    const dup = { ...SAMPLE_RESULT, skills: [...SAMPLE_RESULT.skills, ...SAMPLE_RESULT.skills] };
    const outcome = await parseCv(bytes, { demoResults: { [hashHex]: dup }, sleep: noopSleep });
    expect(outcome).toEqual({ ok: true, result: SAMPLE_RESULT });
  });
});

const CV_PARSE_ENV_KEYS = [
  "KRACKEDDEVS_API_KEY",
  "KRACKEDDEVS_BASE_URL",
  "KRACKEDDEVS_MODEL",
  "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "AI_PROVIDER",
  "AI_MODEL",
] as const;

const ORIGINAL_CV_PARSE_ENV = Object.fromEntries(CV_PARSE_ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreCvParseEnv(): void {
  for (const key of CV_PARSE_ENV_KEYS) {
    const original = ORIGINAL_CV_PARSE_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
}

function modelRoute(model: LanguageModel): { provider: string; modelId: string } {
  return model as unknown as { provider: string; modelId: string };
}

describe("defaultExtractCv provider", () => {
  beforeEach(() => {
    process.env.AI_MOCK = "false";
    resetProviderLogForTests();
    vi.mocked(generateObject).mockReset();
    vi.mocked(generateObject).mockResolvedValue({
      object: { skills: [], roles: [], education: [] },
    } as Awaited<ReturnType<typeof generateObject>>);
  });

  afterEach(() => {
    restoreCvParseEnv();
    vi.restoreAllMocks();
  });

  async function parseWithDefaultExtract(text = "Name: Pat Lee"): Promise<Awaited<ReturnType<typeof parseCv>>> {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("tests must not call the network"));
    const bytes = new TextEncoder().encode("a CV that is not a demo sha256 hit");
    const outcome = await parseCv(bytes, {
      demoResults: {},
      sleep: noopSleep,
      extractPdfText: async () => text,
      embedTexts: async () => {
        throw new Error("no embeddings in tests");
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    return outcome;
  }

  it("uses the openai-compatible KrackedDevs model when KRACKEDDEVS_API_KEY is set", async () => {
    process.env.KRACKEDDEVS_API_KEY = "test-key";
    delete process.env.KRACKEDDEVS_BASE_URL;
    delete process.env.KRACKEDDEVS_MODEL;
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = "https://replit-ai-integrations.example.com";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const outcome = await parseWithDefaultExtract();

    expect(outcome.ok).toBe(true);
    expect(generateObject).toHaveBeenCalledTimes(1);
    const model = vi.mocked(generateObject).mock.calls[0][0].model;
    expect(modelRoute(model).provider).toBe("krackeddevs.chat");
    expect(modelRoute(model).modelId).toBe("deepseek-v4.1-flash");
    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(lines).toContain("[ai] provider=krackeddevs model=deepseek-v4.1-flash");
    expect(lines.join("\n")).not.toContain("test-key");
    expect(lines.join("\n")).not.toContain("http");
  });

  it("uses KRACKEDDEVS_MODEL when that override is set", async () => {
    process.env.KRACKEDDEVS_API_KEY = "test-key";
    process.env.KRACKEDDEVS_MODEL = "sponsor-flash";

    await parseWithDefaultExtract();

    const model = vi.mocked(generateObject).mock.calls[0][0].model;
    expect(modelRoute(model).provider).toBe("krackeddevs.chat");
    expect(modelRoute(model).modelId).toBe("sponsor-flash");
  });

  it("matches today's getModel() path when KRACKEDDEVS_API_KEY is unset", async () => {
    delete process.env.KRACKEDDEVS_API_KEY;
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = "https://replit-ai-integrations.example.com";

    const outcome = await parseWithDefaultExtract();

    expect(outcome.ok).toBe(true);
    const model = vi.mocked(generateObject).mock.calls[0][0].model;
    expect(modelRoute(model).provider).toBe("anthropic.messages");
    expect(modelRoute(model).modelId).toBe("claude-haiku-4-5");
  });

  it("matches today's google fallback when the sponsor key and Anthropic integrations are unset", async () => {
    delete process.env.KRACKEDDEVS_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-key";

    const outcome = await parseWithDefaultExtract();

    expect(outcome.ok).toBe(true);
    const model = vi.mocked(generateObject).mock.calls[0][0].model;
    expect(modelRoute(model).provider).toBe("google.generative-ai");
  });
});

describe("Gemini extraction schema", () => {
  it("sends no maxItems to the model (Gemini rejects it with INVALID_ARGUMENT)", () => {
    expect(JSON.stringify(z.toJSONSchema(CvExtractionSchema))).not.toContain("maxItems");
  });

  it("caps oversized model output after the call instead", () => {
    const many = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
    const capped = capCvExtraction({
      skills: many(100, (i) => `s${i}`),
      roles: many(30, (i) => ({ title: `r${i}`, years: 1, tasks: many(15, (j) => ({ text: `t${j}`, evidence: `e${j}` })) })),
      education: many(20, (i) => ({ qualification: `q${i}`, field: `f${i}` })),
    });
    expect(capped.skills).toHaveLength(CV_EXTRACTION_LIMITS.skills);
    expect(capped.roles).toHaveLength(CV_EXTRACTION_LIMITS.roles);
    expect(capped.roles[0].tasks).toHaveLength(CV_EXTRACTION_LIMITS.tasksPerRole);
    expect(capped.education).toHaveLength(CV_EXTRACTION_LIMITS.education);
    expect(capped.skills[0]).toBe("s0");
  });
});
