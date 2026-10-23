import { describe, expect, it, vi, beforeEach } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { catalogueExposure, clearRoleExposureCache, fetchRoleExposure, lightTone, stateFromResponse } from "./role-exposure";

const exposure = { value: 0.6, sourceName: "ILO GenAI Exposure 2025", tableOrPage: "p", asOf: "2025-05-20", groupEstimate: false };

describe("role exposure", () => {
  beforeEach(() => clearRoleExposureCache());

  it("uses the catalogue figure for a curated role", () => {
    const role = CATALOGUE.occupations.find((item) => item.exposure)!;
    expect(catalogueExposure(role.id)).toMatchObject({ kind: "score", value: role.exposure!.value, basedOn: null });
    expect(catalogueExposure("not-a-role")).toBeUndefined();
  });

  it("maps API statuses to card states", () => {
    expect(stateFromResponse(200, { status: "exact", exposure, borrowedFrom: { roleId: "o1", title: "web developer" } })).toMatchObject({ kind: "score", basedOn: null });
    expect(stateFromResponse(200, { status: "matched", exposure, borrowedFrom: { roleId: "o1", title: "web developer" } })).toMatchObject({ kind: "score", basedOn: "web developer" });
    expect(stateFromResponse(200, { status: "matched", exposure: null, borrowedFrom: { roleId: "o1", title: "x" } })).toEqual({ kind: "unavailable" });
    expect(stateFromResponse(200, { status: "no_close_match" })).toEqual({ kind: "no_close_match" });
    expect(stateFromResponse(503, { status: "embeddings_unavailable" })).toEqual({ kind: "estimating" });
    expect(stateFromResponse(500, null)).toEqual({ kind: "unavailable" });
  });

  it("colours the light by the shared band cut points", () => {
    const score = (value: number) => ({ kind: "score" as const, value, sourceName: "", groupEstimate: false, basedOn: null });
    expect(lightTone(score(0.2))).toBe("low");
    expect(lightTone(score(0.5))).toBe("medium");
    expect(lightTone(score(0.8))).toBe("high");
    expect(lightTone({ kind: "estimating" })).toBe("pending");
  });

  it("requests each title once", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "no_close_match" }), { status: 200 }));
    await Promise.all([fetchRoleExposure("Barista", fetcher), fetchRoleExposure("barista ", fetcher)]);
    await fetchRoleExposure("Barista", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
