// Where live arXiv snapshots are kept, and which one the app uses now.
// Order: newest stored live snapshot (Supabase table trend_snapshots when
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, otherwise this server's
// memory plus a JSON file in the OS temp dir), else the counts bundled in
// src/data/catalogue.json. Every read failure falls back; nothing throws.
import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CATALOGUE } from "@/lib/catalogue";
import { bundledSnapshot, isTrendSnapshot, type ActiveSnapshot, type TrendSnapshot } from "@/lib/live-signals";
import { getSupabase } from "@/lib/supabase";

export const SNAPSHOT_TABLE = "trend_snapshots";
const SUPABASE_TIMEOUT_MS = 5000;

function localPath(): string {
  return process.env.TREND_SNAPSHOT_FILE || join(/* turbopackIgnore: true */ tmpdir(), "laluan-trend-snapshot.json");
}

let memory: TrendSnapshot | null = null;
let lastFailure: { at: string; error: string } | null = null;

/** Test hook: forget the in-memory snapshot and refresh failure. */
export function resetLocalSnapshot() {
  memory = null;
  lastFailure = null;
}

/** Remember that a refresh got nothing from arXiv, so the stored snapshot is now "last good". */
export function recordRefreshFailure(error: string, at: Date = new Date()) {
  lastFailure = { at: at.toISOString(), error };
}

/** The latest refresh failure on this server, if it is newer than the snapshot in use. */
export function refreshFailureSince(fetchedAt: string): { at: string; error: string } | null {
  return lastFailure && lastFailure.at > fetchedAt ? lastFailure : null;
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)),
  ]);
}

async function readLocal(): Promise<TrendSnapshot | null> {
  if (memory) return memory;
  try {
    const parsed: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ localPath(), "utf8"));
    if (isTrendSnapshot(parsed)) memory = parsed;
  } catch {
    // no file yet, or unreadable: treat as none
  }
  return memory;
}

async function writeLocal(snapshot: TrendSnapshot): Promise<void> {
  memory = snapshot;
  try {
    await mkdir(/* turbopackIgnore: true */ dirname(localPath()), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ localPath(), JSON.stringify(snapshot));
  } catch {
    // read-only disk: memory still holds it for this server instance
  }
}

type Stored = { snapshot: TrendSnapshot | null; store: "supabase" | "local"; error: string | null };

async function readStored(): Promise<Stored> {
  const supabase = getSupabase();
  if (!supabase.ok) return { snapshot: await readLocal(), store: "local", error: null };
  try {
    const { data, error } = await withTimeout(
      supabase.client
        .from(SNAPSHOT_TABLE)
        .select("fetched_at, as_of, source, keywords, refreshed")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      SUPABASE_TIMEOUT_MS,
    );
    if (error) throw new Error(error.message);
    if (!data) return { snapshot: null, store: "supabase", error: null };
    const snapshot = {
      source: data.source,
      fetchedAt: new Date(data.fetched_at).toISOString(),
      asOf: data.as_of,
      keywords: data.keywords,
      refreshed: data.refreshed ?? [],
    };
    if (!isTrendSnapshot(snapshot)) throw new Error("stored snapshot has an unexpected shape");
    return { snapshot, store: "supabase", error: null };
  } catch (error) {
    // Supabase down or table missing: try this server's own copy before the bundle.
    const local = await readLocal();
    return { snapshot: local, store: "local", error: `Supabase unavailable (${error instanceof Error ? error.message : String(error)})` };
  }
}

/** The snapshot to rank with now, and where it came from. */
export async function getActiveSnapshot(): Promise<ActiveSnapshot> {
  const stored = await readStored();
  if (stored.snapshot) {
    return { snapshot: stored.snapshot, origin: "live", store: stored.store, warning: stored.error };
  }
  return { snapshot: bundledSnapshot(CATALOGUE), origin: "bundled", store: null, warning: stored.error };
}

/** Persist a snapshot. Returns where it landed; a Supabase failure falls back to local. */
export async function saveSnapshot(snapshot: TrendSnapshot): Promise<{ store: "supabase" | "local"; warning: string | null }> {
  await writeLocal(snapshot);
  lastFailure = null;
  const supabase = getSupabase();
  if (!supabase.ok) return { store: "local", warning: null };
  try {
    const { error } = await withTimeout(
      supabase.client.from(SNAPSHOT_TABLE).insert({
        source: snapshot.source,
        fetched_at: snapshot.fetchedAt,
        as_of: snapshot.asOf,
        keywords: snapshot.keywords,
        refreshed: snapshot.refreshed,
      }),
      SUPABASE_TIMEOUT_MS,
    );
    if (error) throw new Error(error.message);
    return { store: "supabase", warning: null };
  } catch (error) {
    return { store: "local", warning: `Saved on this server only: Supabase unavailable (${error instanceof Error ? error.message : String(error)})` };
  }
}
