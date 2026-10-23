import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", () => ({ getModel: () => ({ ok: false, error: "no model in tests" }) }));
import { CATALOGUE } from "@/lib/catalogue";
import { POST } from "./route";

const KNOWN_ROLE = CATALOGUE.occupations[0];

function post(body: unknown): Promise<Response> {
  const request = new Request("http://localhost/api/exposure-estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("POST /api/exposure-estimate", () => {
  it("rejects a missing title", async () => {
    const response = await post({});
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/title|invalid/i);
  });

  it("rejects an empty title", async () => {
    const response = await post({ title: "   " });
    expect(response.status).toBe(400);
  });

  it("rejects an unknown field (strict schema)", async () => {
    const response = await post({ title: "Software developer", extra: true });
    expect(response.status).toBe(400);
  });

  it("rejects a non-JSON body", async () => {
    const request = new Request("http://localhost/api/exposure-estimate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns the catalogue role directly for an exact title match", async () => {
    const response = await post({ title: KNOWN_ROLE.title });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "matched",
      matchedVia: "exact",
      exposure: KNOWN_ROLE.exposure,
      borrowedFrom: { roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title },
    });
  });

  it("matches via the alias table", async () => {
    const response = await post({ title: "Jururawat" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "matched", matchedVia: "alias", borrowedFrom: { roleId: "o025" } });
  });

  it("returns 503 model_unavailable for an unknown title when no model is configured", async () => {
    const response = await post({ title: "Underwater basket weaver" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "model_unavailable" });
  });
});
