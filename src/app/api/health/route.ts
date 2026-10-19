// GET /api/health: runs the same checks shown on /status, for scripts/monitoring.
import { runHealthChecks } from "@/lib/health";

// Pass ?deep=1 to also make a live AI request (Gemini or RunPod); the default only checks config.
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const checks = await runHealthChecks({ deep });
  const ok = checks.every((check) => check.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
