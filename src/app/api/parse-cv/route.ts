// POST /api/parse-cv: accepts one PDF (multipart/form-data, field "file")
// and returns the parsed profile fields. See src/lib/parse-cv.ts for the
// sha256 demo short-circuit, text extraction, Gemini call and ESCO mapping.
import { CV_MIME_TYPE, MAX_CV_BYTES } from "@/lib/cv-upload-limits";
import { parseCv } from "@/lib/parse-cv";

// Every route handler in this app runs on the Node runtime (the project's
// cacheComponents setting doesn't allow an explicit `runtime` export, and
// there is no Edge-only route here to opt out for) — unpdf (pdf.js) and
// node:crypto, which this route needs, are both available there.

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Request body must be multipart/form-data." }, { status: 400 });
  }

  // formData.get() returns `string | File | null`. Checked by excluding
  // string/null rather than `instanceof File`: that class isn't guaranteed
  // to be the same object across every runtime that parses a FormData.
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.type !== CV_MIME_TYPE) {
    return Response.json({ error: "File must be a PDF." }, { status: 400 });
  }
  if (file.size > MAX_CV_BYTES) {
    return Response.json({ error: "File must be 2 MB or smaller." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const outcome = await parseCv(bytes);
  if (!outcome.ok) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }
  return Response.json(outcome.result);
}
