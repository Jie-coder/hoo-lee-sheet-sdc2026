// Server side of POST /api/verify-certificate: fetches the public certificate
// page, then asks the KrackedDevs LiteLLM model (same endpoint and key as CV
// parse) whether it is a genuine certificate for the expected course.
// Never logs the page text, the URL or any API key.
import "server-only";
import { lookup } from "node:dns/promises";
import { generateText } from "ai";
import { getCvParseModel } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import {
  FETCH_TIMEOUT_MS,
  MAX_PAGE_BYTES,
  buildVerificationPrompt,
  demoCertificateVerdict,
  htmlToText,
  isBlockedHost,
  mockVerdict,
  parsePublicHttpUrl,
  parseVerificationResponse,
  pendingResult,
  type VerifyCertificateInput,
  type VerifyCertificateResult,
} from "@/lib/verify-certificate";

const MAX_REDIRECTS = 3;

class FetchProblem extends Error {}

/** Resolves the host and refuses private addresses (blocks DNS names that point inside). */
async function assertPublicAddress(url: URL): Promise<void> {
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedHost(entry.address))) {
    throw new FetchProblem("The link points to a private address.");
  }
}

async function fetchPageText(start: URL): Promise<string> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicAddress(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "text/html,text/plain;q=0.9", "user-agent": "LaluanCertificateCheck/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next = location ? parsePublicHttpUrl(new URL(location, url).toString()) : null;
      if (!next) throw new FetchProblem("The link redirects somewhere that cannot be checked.");
      url = next;
      continue;
    }
    if (!response.ok) throw new FetchProblem(`The page responded with status ${response.status}.`);
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/(html|plain)|application\/xhtml/i.test(type)) {
      throw new FetchProblem("The link is not a web page that can be read (for example a PDF or image).");
    }
    return htmlToText(await readCapped(response));
  }
  throw new FetchProblem("The link redirects too many times.");
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (received < MAX_PAGE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return text;
}

export async function verifyCertificate(
  input: VerifyCertificateInput,
  now: () => Date = () => new Date(),
): Promise<VerifyCertificateResult> {
  const checkedAt = now().toISOString();
  // Demo link verifies before mock, fetch, API key, or title matching.
  const demo = demoCertificateVerdict(input.certificateUrl, input.expectedTitle, checkedAt);
  if (demo) return demo;

  const env = getEnv();
  if (env.aiMock) return mockVerdict(input, checkedAt);

  const url = parsePublicHttpUrl(input.certificateUrl);
  if (!url) return { ok: false, status: "failed", reason: "The link is not a public http(s) URL.", checkedAt };
  if (!env.krackeddevsApiKey) {
    return pendingResult("The certificate check is not configured on this server.", checkedAt);
  }

  let pageText: string;
  try {
    pageText = await fetchPageText(url);
  } catch (error) {
    const reason =
      error instanceof FetchProblem
        ? error.message
        : "The certificate page could not be fetched (timeout or network error).";
    return pendingResult(reason, checkedAt);
  }
  if (pageText.length < 20) {
    return pendingResult("The page has no readable text (it may need a login or run in the browser only).", checkedAt);
  }

  const modelResult = getCvParseModel();
  if (!modelResult.ok) return pendingResult("The certificate check is unavailable right now.", checkedAt);
  try {
    const { system, prompt } = buildVerificationPrompt({
      expectedTitle: input.expectedTitle,
      provider: input.provider,
      certificateUrl: url.toString(),
      pageText,
    });
    const { text } = await generateText({
      model: modelResult.model,
      system,
      prompt,
      temperature: 0,
      abortSignal: AbortSignal.timeout(30_000),
    });
    return (
      parseVerificationResponse(text, checkedAt) ??
      pendingResult("The check returned an unreadable answer. Try again.", checkedAt)
    );
  } catch {
    return pendingResult("The certificate check is unavailable right now.", checkedAt);
  }
}
