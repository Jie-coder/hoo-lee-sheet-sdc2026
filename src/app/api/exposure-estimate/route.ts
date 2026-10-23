// POST /api/exposure-estimate: maps a job title to one of the 40 curated
// Laluan roles (exact -> alias table -> LLM) and returns that role's real
// exposure. See src/lib/exposure-estimate.ts.
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
  if (result.status === "model_unavailable") {
    return Response.json(result, { status: 503 });
  }
  return Response.json(result);
}
