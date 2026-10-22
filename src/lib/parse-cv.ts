// Turns an uploaded CV (PDF bytes) into the editable profile fields on
// /profile: sha256 short-circuit for the 3 demo CVs, otherwise unpdf text
// extraction + one Gemini structured-extraction call + ESCO skill mapping.
// Never logs the CV text or any API key.
import "server-only";
import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { getDocumentProxy, extractText } from "unpdf";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { mapSkillsToEsco, type SkillMatchDeps } from "@/lib/skill-match";
import type { ParsedCvEducation, ParsedCvRole } from "@/types/contracts";
import demoResultsJson from "@/data/demo-cv-results.json";
import mockFixture from "@/fixtures/parse-cv-mock.json";

/** Current stable Gemini Flash (https://ai.google.dev/gemini-api/docs/models). */
const DEFAULT_CV_MODEL = "gemini-2.5-flash";

/** How long the sha256-hit and AI_MOCK paths wait before responding, so the
 * upload area's "Reading / Extracting / Matching" steps are visible even
 * when there is no real AI call to wait for. */
const DEMO_DELAY_MS = 1500;

export type ParsedSkill = { label: string; matched: boolean };

/** What POST /api/parse-cv returns on success. Shares its shape with
 * FlowProfile's roles/education (src/context/flow-context.tsx) so the
 * client can drop it straight into the editable profile panel. */
export type ParsedCvResult = {
  name: string;
  roles: ParsedCvRole[];
  education: ParsedCvEducation[];
  skills: ParsedSkill[];
};

const ParsedCvResultSchema = z.strictObject({
  name: z.string(),
  roles: z.array(
    z.strictObject({ title: z.string().min(1), years: z.number().nonnegative(), tasks: z.array(z.string().min(1)) }),
  ),
  education: z.array(z.strictObject({ level: z.string().min(1), field: z.string().min(1) })),
  skills: z.array(z.strictObject({ label: z.string().min(1), matched: z.boolean() })),
});

/** sha256 hex -> precomputed ParsedCvResult, for the 3 demo CVs (demo/cv/*.pdf).
 * Written once by scripts/precompute-demo-cvs.ts; `{}` until that has run. */
const DemoResultsSchema = z.record(z.string(), ParsedCvResultSchema);

const DEFAULT_DEMO_RESULTS: Record<string, ParsedCvResult> = (() => {
  const parsed = DemoResultsSchema.safeParse(demoResultsJson);
  return parsed.success ? parsed.data : {};
})();

/**
 * What Gemini is asked to return. Deliberately smaller than ParsedCV in
 * contracts.ts: no per-role tasks (not shown on /profile), mapped onto
 * ParsedCvRole/ParsedCvEducation afterwards. Education asks for the
 * qualification and its field of study (major/subject) to line up with
 * ParsedCvEducation's level/field; the school name is not collected since
 * ParsedCvEducation has nowhere to put it.
 */
const CvExtractionSchema = z.strictObject({
  name: z.string().min(1).optional().describe("The person's name, only if it is written on the CV."),
  skills: z.array(z.string().min(1)).max(60).describe("Skills and tools, exactly as written."),
  roles: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        years: z.number().nonnegative().describe("Years in the role, estimated from the dates given."),
      }),
    )
    .max(20),
  education: z
    .array(
      z.strictObject({
        qualification: z.string().min(1).describe('The degree or qualification name, e.g. "Diploma in Business".'),
        field: z.string().min(1).describe('The major or field of study, e.g. "Business Administration".'),
      }),
    )
    .max(10),
});
export type CvExtraction = z.infer<typeof CvExtractionSchema>;

const EXTRACTION_SYSTEM_PROMPT =
  "You read a CV's plain text and extract only what is written in it: the person's name if it appears, " +
  "their skills and tools, their roles (title and years in each, estimated from any dates given), and their " +
  "education (the qualification/degree, and its major or field of study). Never invent a name, skill, role, " +
  "qualification, or field of study that is not in the text. If a field is not in the text, leave it out " +
  "rather than guessing.";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toParsedCvResult(extraction: CvExtraction, skills: ParsedSkill[]): ParsedCvResult {
  return {
    name: extraction.name ?? "",
    roles: extraction.roles.map((role) => ({ title: role.title, years: role.years, tasks: [] })),
    education: extraction.education.map((edu) => ({ level: edu.qualification, field: edu.field })),
    skills,
  };
}

async function defaultExtractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function defaultExtractCv(text: string): Promise<CvExtraction> {
  const env = getEnv();
  if (!env.googleApiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  const google = createGoogle({ apiKey: env.googleApiKey });
  const model = google(env.aiModel || DEFAULT_CV_MODEL);
  const { object } = await generateObject({
    model,
    schema: CvExtractionSchema,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: text,
  });
  return object;
}

export type ParseCvOutcome = { ok: true; result: ParsedCvResult } | { ok: false; status: 422 | 500; error: string };

export type ParseCvDeps = SkillMatchDeps & {
  /** Default: DEFAULT_DEMO_RESULTS (src/data/demo-cv-results.json). */
  demoResults?: Record<string, ParsedCvResult>;
  /** Default: unpdf. */
  extractPdfText?: (bytes: Uint8Array) => Promise<string>;
  /** Default: Gemini generateObject. */
  extractCv?: (text: string) => Promise<CvExtraction>;
  /** Default: a real setTimeout-based delay. Tests pass a no-op so they run instantly. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Diagnostics-only: called with the raw Gemini extraction (skills in CV
   * order, before ESCO mapping) once it's available. scripts/precompute-demo-cvs.ts
   * uses this to pair each raw skill with how mapSkillsToEsco resolved it.
   */
  onExtracted?: (extraction: CvExtraction) => void;
};

export async function parseCv(bytes: Uint8Array, deps: ParseCvDeps = {}): Promise<ParseCvOutcome> {
  const wait = deps.sleep ?? sleep;
  const demoResults = deps.demoResults ?? DEFAULT_DEMO_RESULTS;

  const demoHit = demoResults[sha256Hex(bytes)];
  if (demoHit) {
    await wait(DEMO_DELAY_MS);
    return { ok: true, result: demoHit };
  }

  const env = getEnv();
  if (env.aiMock) {
    await wait(DEMO_DELAY_MS);
    return { ok: true, result: mockFixture as ParsedCvResult };
  }

  return extractAndMapCv(bytes, deps);
}

/**
 * The real pipeline (steps b-d of T06): unpdf text extraction, the Gemini
 * extraction call, then ESCO skill mapping. No sha256 short-circuit and no
 * AI_MOCK fixture — `parseCv` checks those first and only falls through to
 * this for a CV it doesn't already know. scripts/precompute-demo-cvs.ts
 * calls this directly, since its whole job is to populate the sha256 table
 * this skips.
 */
export async function extractAndMapCv(bytes: Uint8Array, deps: ParseCvDeps = {}): Promise<ParseCvOutcome> {
  const extractPdfText = deps.extractPdfText ?? defaultExtractPdfText;
  let text: string;
  try {
    text = await extractPdfText(bytes);
  } catch {
    // A corrupt or unreadable PDF throws inside unpdf/pdf.js; that's a bad
    // upload, not a server error, so this is a 422 like the scanned-PDF case.
    return { ok: false, status: 422, error: "Could not read that PDF." };
  }
  if (!text.trim()) {
    return { ok: false, status: 422, error: "Scanned PDFs are not supported." };
  }

  const extractCv = deps.extractCv ?? defaultExtractCv;
  let extraction: CvExtraction;
  try {
    extraction = await extractCv(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI provider error.";
    return { ok: false, status: 500, error: `Could not read that CV: ${message}` };
  }
  deps.onExtracted?.(extraction);

  const skills = await mapSkillsToEsco(extraction.skills, deps);
  return { ok: true, result: toParsedCvResult(extraction, skills) };
}
