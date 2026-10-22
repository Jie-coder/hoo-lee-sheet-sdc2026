// POST /api/exposure-estimate: given a job title that may not be one of the
// 40 curated Laluan roles, returns an exposure estimate borrowed from the
// closest curated role by title-embedding similarity. See
// src/lib/exposure-estimate.ts for the matching logic and thresholds.
import { z } from "zod";
import { estimateExposure } from "@/lib/exposure-estimate";

const RequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown validation error"}` },
      { status: 400 },
    );
  }

  const result = await estimateExposure(parsed.data.title);
  if (result.status === "embeddings_unavailable") {
    return Response.json(result, { status: 503 });
  }
  return Response.json(result);
}
