// POST /api/analyze: validates the input text and runs it through the AI layer.
import { analyze } from "@/lib/ai";
import { AnalyzeRequestSchema } from "@/lib/schema";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown validation error"}` },
      { status: 400 }
    );
  }

  const result = await analyze(parsed.data.input);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ data: result.data, source: result.source });
}
