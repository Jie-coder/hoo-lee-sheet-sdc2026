// POST /api/verify-certificate: { certificateUrl, itemId, expectedTitle, provider? }
// -> { ok, status: "verified" | "failed" | "pending", reason, matchedTitle?, checkedAt }.
// See src/lib/verify-certificate-run.ts. "pending" means the check could not
// run (no key, fetch or model error); it is never a fake verification.
import { parsePublicHttpUrl } from "@/lib/verify-certificate";
import { verifyCertificate } from "@/lib/verify-certificate-run";

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const certificateUrl = text(record.certificateUrl, 2000);
  const itemId = text(record.itemId, 200);
  const expectedTitle = text(record.expectedTitle, 300);
  const provider = record.provider === undefined ? undefined : (text(record.provider, 200) ?? undefined);
  if (!certificateUrl || !itemId || !expectedTitle) {
    return Response.json({ error: "certificateUrl, itemId and expectedTitle are required." }, { status: 400 });
  }
  if (!parsePublicHttpUrl(certificateUrl)) {
    return Response.json({ error: "certificateUrl must be a public http(s) URL." }, { status: 400 });
  }
  const result = await verifyCertificate({ certificateUrl, itemId, expectedTitle, provider });
  return Response.json(result);
}
