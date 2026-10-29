// POST /api/refresh-signals: re-counts arXiv papers for the catalogue's
// keywords now (stalest first, within a time budget), stores the snapshot
// with its fetch time, and returns it. If arXiv is unavailable nothing is
// stored and the last good snapshot stays in use.
// Default: the stalest keywords within ~20 s; ?full=1 re-counts all of them.
// Body (optional JSON): { "keywords": ["AI agents", ...] } to refresh only those.
import { z } from "zod";
import { FULL_BUDGET_MS, arxivTestHooks, refreshFromArxiv } from "@/lib/arxiv-live";
import { getActiveSignals } from "@/lib/signals";
import { getActiveSnapshot, recordRefreshFailure, saveSnapshot } from "@/lib/signal-store";

// A full re-count (?full=1) takes about 2.6 min at arXiv's rate limit.
export const maxDuration = 300;

const BodySchema = z.strictObject({ keywords: z.array(z.string().min(1).max(200)).min(1).max(50).optional() });

let inFlight: Promise<Response> | null = null;

async function run(keywords: string[] | undefined, full: boolean): Promise<Response> {
  const before = await getActiveSnapshot();
  const outcome = await refreshFromArxiv(before.snapshot, { ...(full ? { budgetMs: FULL_BUDGET_MS } : {}), ...arxivTestHooks.options, keywords });
  if (outcome.refreshed.length === 0) {
    recordRefreshFailure(outcome.failed[0]?.error ?? "no keywords refreshed");
    return Response.json(
      {
        error: "arXiv is unavailable right now; still using the last good snapshot.",
        failed: outcome.failed,
        active: await getActiveSignals(),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  await saveSnapshot(outcome.snapshot);
  return Response.json(
    {
      active: await getActiveSignals(),
      refreshed: outcome.refreshed,
      skipped: outcome.skipped,
      failed: outcome.failed,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: "Request body must be JSON." }, { status: 400 });
    }
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: `Invalid input: ${parsed.error.issues[0]?.message ?? "unknown"}` }, { status: 400 });
  }
  // One refresh at a time per server: a double click joins the running one.
  const full = ["1", "true"].includes(new URL(request.url).searchParams.get("full") ?? "");
  if (!inFlight) {
    inFlight = run(parsed.data.keywords, full).finally(() => {
      inFlight = null;
    });
  }
  return (await inFlight).clone();
}
