import { describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { cosineSimilarity, estimateExposure } from "@/lib/exposure-estimate";

const byId = (id: string) => CATALOGUE.occupations.find((o) => o.id === id)!;

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for a zero vector", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
  it("throws on length mismatch", () => {
    expect(() => cosineSimilarity([1], [1, 2])).toThrow(/same length/);
  });
});

describe("estimateExposure", () => {
  it("exact catalogue title -> matchedVia exact, without calling the model", async () => {
    const role = CATALOGUE.occupations[0];
    const pickRole = vi.fn();
    const result = await estimateExposure(`  ${role.title.toUpperCase()} `, { pickRole });
    expect(result).toEqual({
      status: "matched",
      matchedVia: "exact",
      exposure: role.exposure,
      borrowedFrom: { roleId: role.id, title: role.title },
    });
    expect(pickRole).not.toHaveBeenCalled();
  });

  it("alias hit -> that catalogue role's real exposure, without calling the model", async () => {
    const pickRole = vi.fn();
    const result = await estimateExposure("Juruwang", { pickRole });
    expect(result).toEqual({
      status: "matched",
      matchedVia: "alias",
      exposure: byId("o039").exposure,
      borrowedFrom: { roleId: "o039", title: byId("o039").title },
    });
    expect(pickRole).not.toHaveBeenCalled();
  });

  it("alias explicitly mapped to null -> no_close_match without calling the model", async () => {
    const pickRole = vi.fn();
    expect(await estimateExposure("Lawyer", { pickRole })).toEqual({ status: "no_close_match", matchedVia: "alias" });
    expect(pickRole).not.toHaveBeenCalled();
  });

  it("alias miss -> model picks a valid catalogue id -> matchedVia llm", async () => {
    const result = await estimateExposure("Underwater basket weaver", { pickRole: async () => "o009" });
    expect(result).toMatchObject({ status: "matched", matchedVia: "llm", borrowedFrom: { roleId: "o009" } });
  });

  it("model returns a role outside the 40 -> no_close_match", async () => {
    expect(await estimateExposure("Underwater basket weaver", { pickRole: async () => "o999" })).toEqual({
      status: "no_close_match",
      matchedVia: "llm",
    });
    expect(await estimateExposure("Underwater basket weaver", { pickRole: async () => "none" })).toEqual({
      status: "no_close_match",
      matchedVia: "llm",
    });
  });

  it("model failure -> model_unavailable", async () => {
    const result = await estimateExposure("Underwater basket weaver", {
      pickRole: async () => {
        throw new Error("quota");
      },
    });
    expect(result).toEqual({ status: "model_unavailable" });
  });
});
