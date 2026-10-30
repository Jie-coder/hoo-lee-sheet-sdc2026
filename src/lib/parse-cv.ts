// Turns an uploaded CV (PDF bytes) into the editable profile fields on
// /profile: sha256 short-circuit for the 3 demo CVs, otherwise unpdf text
// extraction + one Gemini structured-extraction call + ESCO skill mapping.
// Never logs the CV text or any API key.
import "server-only";
import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { getDocumentProxy, extractText } from "unpdf";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getModel } from "@/lib/ai";
import { mapSkillsToEsco, type SkillMatchDeps } from "@/lib/skill-match";
import type { ParsedCvEducation, ParsedCvRole } from "@/types/contracts";
import demoResultsJson from "@/data/demo-cv-results.json";
import mockFixture from "@/fixtures/parse-cv-mock.json";

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
export const CvExtractionSchema = z.strictObject({
  name: z.string().min(1).optional().describe("The person's name, only if it is written on the CV."),
  skills: z.array(z.string().min(1)).describe("Skills and tools, exactly as written."),
  roles: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        years: z.number().nonnegative().describe("Years in the role, estimated from the dates given."),
        tasks: z
          .array(
            z.strictObject({
              text: z.string().min(1).describe("A short description of one task or responsibility performed in this role."),
              evidence: z
                .string()
                .min(1)
                .describe("A verbatim quote copied exactly from the CV text that supports this task."),
            }),
          )
          .describe(
            "Tasks performed in this role. Every task must carry a verbatim evidence quote; " +
              "tasks without a quote found in the CV are dropped before the response is returned.",
          ),
      }),
    ),
  education: z
    .array(
      z.strictObject({
        qualification: z.string().min(1).describe('The degree or qualification name, e.g. "Diploma in Business".'),
        field: z.string().min(1).describe('The major or field of study, e.g. "Business Administration".'),
      }),
    ),
});
export type CvExtraction = z.infer<typeof CvExtractionSchema>;

/**
 * Caps on how many items we keep from the model's answer. Enforced here,
 * after the call, NOT in CvExtractionSchema: Gemini rejects the request with
 * 400 "Request contains an invalid argument" when the response schema carries
 * these nested `maxItems` limits (reproduced against gemini-3.8-flash).
 */
export const CV_EXTRACTION_LIMITS = { skills: 60, roles: 20, tasksPerRole: 10, education: 10 } as const;

export function capCvExtraction(extraction: CvExtraction): CvExtraction {
  return {
    ...extraction,
    skills: extraction.skills.slice(0, CV_EXTRACTION_LIMITS.skills),
    roles: extraction.roles
      .slice(0, CV_EXTRACTION_LIMITS.roles)
      .map((role) => ({ ...role, tasks: role.tasks.slice(0, CV_EXTRACTION_LIMITS.tasksPerRole) })),
    education: extraction.education.slice(0, CV_EXTRACTION_LIMITS.education),
  };
}

const EXTRACTION_SYSTEM_PROMPT =
  "You read a CV's plain text and extract only what is written in it: the person's name if it appears, " +
  "their skills and tools, their roles (title and years in each, estimated from any dates given, plus the " +
  "tasks or responsibilities performed in that role), and their education (the qualification/degree, and its " +
  "major or field of study). For every task, copy a short verbatim quote from the CV text into its evidence " +
  "field, copied exactly as written (same words, same spelling) so it can be found in the original text; do " +
  "not paraphrase the evidence. Never invent a name, skill, role, task, qualification, or field of study that " +
  "is not in the text. If a field is not in the text, leave it out rather than guessing.";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes text before checking that a task's evidence quote actually
 * appears in the CV: lowercases, folds curly quotes/dashes to their plain
 * ASCII equivalents (the model sometimes "prettifies" punctuation when
 * quoting), and collapses whitespace so a line-wrapped quote still matches.
 */
function normalizeForEvidenceMatch(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Keeps only the tasks whose evidence quote is actually findable in the CV
 * text (after normalization), dropping the rest. This is the only guard
 * against an invented task: the model schema requires a quote, but only
 * checking it against the source text catches a quote that was paraphrased
 * or fabricated rather than copied.
 */
function verifiedTaskTexts(tasks: CvExtraction["roles"][number]["tasks"], normalizedCvText: string): string[] {
  return tasks
    .filter((task) => normalizedCvText.includes(normalizeForEvidenceMatch(task.evidence)))
    .map((task) => task.text);
}

/**
 * Drops repeated skills after ESCO mapping. Different raw CV labels ("Excel",
 * "Microsoft Excel") can resolve to the same ESCO skill; matched skills carry
 * the canonical catalogue label, which is 1:1 with the ESCO skill id, so they
 * are keyed by that label. Unmatched (free-text) skills are keyed by a
 * normalized label (trimmed, lowercased, whitespace collapsed). The first
 * occurrence wins, preserving CV order. Matched and unmatched keys are kept
 * apart so free text never collapses into an ESCO match.
 */
export function dedupeParsedSkills(skills: readonly ParsedSkill[]): ParsedSkill[] {
  const seen = new Set<string>();
  const out: ParsedSkill[] = [];
  for (const skill of skills) {
    const norm = skill.label.trim().toLowerCase().replace(/\s+/g, " ");
    const key = `${skill.matched ? "esco" : "free"}:${norm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

function toParsedCvResult(extraction: CvExtraction, skills: ParsedSkill[], cvText: string): ParsedCvResult {
  const normalizedCvText = normalizeForEvidenceMatch(cvText);
  return {
    name: extraction.name ?? "",
    roles: extraction.roles.map((role) => ({
      title: role.title,
      years: role.years,
      tasks: verifiedTaskTexts(role.tasks, normalizedCvText),
    })),
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
  const modelResult = getModel();
  if (!modelResult.ok) {
    throw new Error(modelResult.error);
  }
  const { object } = await generateObject({
    model: modelResult.model,
    schema: CvExtractionSchema,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: text,
  });
  return capCvExtraction(object);
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
    return { ok: true, result: { ...demoHit, skills: dedupeParsedSkills(demoHit.skills) } };
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

  const skills = dedupeParsedSkills(await mapSkillsToEsco(extraction.skills, deps));
  return { ok: true, result: toParsedCvResult(extraction, skills, text) };
}
