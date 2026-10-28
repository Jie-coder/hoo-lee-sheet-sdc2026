// GET /api/signals: the trend signals the app ranks with now, from
// getActiveSignals(): { snapshot (contracts SignalSnapshot), source
// ("live" | "last-good" | "bundled"), fetchedAt, store, warning, trend }.
// Refresh them with POST /api/refresh-signals.
import { connection } from "next/server";
import { getActiveSignals } from "@/lib/signals";

export async function GET() {
  await connection();
  return Response.json(await getActiveSignals(), { headers: { "Cache-Control": "no-store" } });
}
