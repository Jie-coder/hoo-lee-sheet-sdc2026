// Client-side lookup of a role card's AI exposure. Roles in the 40-role
// catalogue use their published ILO figure directly (no request). Any other
// title asks POST /api/exposure-estimate once per title; results are cached
// in memory for the session so re-ranking or switching scenarios never
// repeats a request.
import { CATALOGUE } from "@/lib/catalogue";
import { scoreBand } from "@/types/contracts";

export type RoleExposureState =
  | { kind: "score"; value: number; sourceName: string; groupEstimate: boolean; basedOn: string | null }
  | { kind: "no_close_match" }
  | { kind: "estimating" }
  | { kind: "unavailable" };

export type LightTone = "low" | "medium" | "high" | "pending";

/** Signal-light colour from the shared Low/Medium/High cut points (SCORE_BAND_THRESHOLDS). */
export function lightTone(state: RoleExposureState): LightTone {
  return state.kind === "score" ? scoreBand(state.value) : "pending";
}

/** Exposure for a catalogue role id, or undefined when the id isn't in the catalogue. */
export function catalogueExposure(occupationId: string): RoleExposureState | undefined {
  const occupation = CATALOGUE.occupations.find((item) => item.id === occupationId);
  if (!occupation) return undefined;
  if (!occupation.exposure) return { kind: "unavailable" };
  return {
    kind: "score",
    value: occupation.exposure.value,
    sourceName: occupation.exposure.sourceName,
    groupEstimate: occupation.exposure.groupEstimate,
    basedOn: null,
  };
}

type ApiExposure = { value: number; sourceName: string; groupEstimate: boolean } | null;
type ApiResult =
  | { status: "exact" | "matched"; exposure: ApiExposure; borrowedFrom: { roleId: string; title: string } }
  | { status: "no_close_match" }
  | { status: "embeddings_unavailable" };

/** Maps an /api/exposure-estimate response (or failure) to what the card shows. */
export function stateFromResponse(httpStatus: number, body: unknown): RoleExposureState {
  // 503 means embeddings aren't ready yet (role-embeddings.json is empty until precompute runs).
  if (httpStatus === 503) return { kind: "estimating" };
  if (httpStatus < 200 || httpStatus >= 300 || !body || typeof body !== "object") return { kind: "unavailable" };
  const result = body as ApiResult;
  if (result.status === "no_close_match") return { kind: "no_close_match" };
  if (result.status === "embeddings_unavailable") return { kind: "estimating" };
  if ((result.status === "exact" || result.status === "matched") && result.exposure) {
    return {
      kind: "score",
      value: result.exposure.value,
      sourceName: result.exposure.sourceName,
      groupEstimate: result.exposure.groupEstimate,
      basedOn: result.status === "matched" ? result.borrowedFrom.title : null,
    };
  }
  return { kind: "unavailable" };
}

const cache = new Map<string, Promise<RoleExposureState>>();

export function fetchRoleExposure(title: string, fetcher: typeof fetch = fetch): Promise<RoleExposureState> {
  const key = title.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = fetcher("/api/exposure-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
    .then(async (response) => stateFromResponse(response.status, await response.json().catch(() => null)))
    .catch((): RoleExposureState => ({ kind: "unavailable" }));
  cache.set(key, pending);
  // Don't pin a transient "estimating" forever: drop it so a later mount can retry.
  pending.then((state) => state.kind === "estimating" && cache.delete(key));
  return pending;
}

export function clearRoleExposureCache() {
  cache.clear();
}
