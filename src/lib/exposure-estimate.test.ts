import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import {
  cosineSimilarity,
  estimateExposure,
  EXPOSURE_MATCH_THRESHOLD,
  type RoleEmbeddingsFile,
} from "@/lib/exposure-estimate";

const KNOWN_ROLE = CATALOGUE.occupations[0];

function embeddingsFile(roles: RoleEmbeddingsFile["roles"]): RoleEmbeddingsFile {
  return { model: "gemini-embedding-001", dimensions: 3, generatedAt: "2026-10-01T00:00:00.000Z", roles };
}

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("is -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("is scale-invariant", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it("is 0 when either vector is all zeros, instead of dividing by zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("throws when the vectors have different lengths", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/same length/);
  });
});

describe("estimateExposure", () => {
  it("returns the catalogue role directly, with similarity 1, for an exact (case/whitespace-insensitive) title match", async () => {
    const embedTitle = vi.fn();
    const loadRoleEmbeddings = vi.fn();

    const result = await estimateExposure(`  ${KNOWN_ROLE.title.toUpperCase()}  `, { embedTitle, loadRoleEmbeddings });

    expect(result).toEqual({
      status: "exact",
      exposure: KNOWN_ROLE.exposure,
      borrowedFrom: { roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title },
      similarity: 1,
    });
    expect(embedTitle).not.toHaveBeenCalled();
    expect(loadRoleEmbeddings).not.toHaveBeenCalled();
  });

  it("returns embeddings_unavailable, without calling embedTitle, when the embeddings file is missing", async () => {
    const embedTitle = vi.fn();
    const loadRoleEmbeddings = vi.fn(() => null);

    const result = await estimateExposure("Underwater basket weaver", { embedTitle, loadRoleEmbeddings });

    expect(result).toEqual({ status: "embeddings_unavailable" });
    expect(embedTitle).not.toHaveBeenCalled();
  });

  it("returns embeddings_unavailable when the embeddings file has no roles", async () => {
    const loadRoleEmbeddings = vi.fn(() => embeddingsFile([]));

    const result = await estimateExposure("Underwater basket weaver", { loadRoleEmbeddings });

    expect(result).toEqual({ status: "embeddings_unavailable" });
  });

  it("returns embeddings_unavailable when embedTitle itself fails (quota, missing key, ...)", async () => {
    const loadRoleEmbeddings = vi.fn(() => embeddingsFile([{ roleId: "o001", title: "Software developer", embedding: [1, 0, 0] }]));
    const embedTitle = vi.fn(async () => {
      throw new Error("Quota exceeded");
    });

    const result = await estimateExposure("Some unknown title", { embedTitle, loadRoleEmbeddings });

    expect(result).toEqual({ status: "embeddings_unavailable" });
  });

  it("borrows the closest role's exposure when the best cosine similarity clears the threshold", async () => {
    const roles: RoleEmbeddingsFile["roles"] = [
      { roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title, embedding: [1, 0, 0] },
      { roleId: "other", title: "Unrelated role", embedding: [0, 1, 0] },
    ];
    const loadRoleEmbeddings = vi.fn(() => embeddingsFile(roles));
    const embedTitle = vi.fn(async () => [1, 0, 0.01]);

    const result = await estimateExposure("a near-synonym title", { embedTitle, loadRoleEmbeddings });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.borrowedFrom).toEqual({ roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title });
      expect(result.exposure).toEqual(KNOWN_ROLE.exposure);
      expect(result.similarity).toBeGreaterThanOrEqual(EXPOSURE_MATCH_THRESHOLD);
    }
  });

  it("returns no_close_match when the best cosine similarity is below the threshold", async () => {
    const roles: RoleEmbeddingsFile["roles"] = [{ roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title, embedding: [1, 0, 0] }];
    const loadRoleEmbeddings = vi.fn(() => embeddingsFile(roles));
    const embedTitle = vi.fn(async () => [0, 1, 0]);

    const result = await estimateExposure("a completely different title", { embedTitle, loadRoleEmbeddings });

    expect(result).toEqual({ status: "no_close_match" });
  });

  it("picks the single best match among several roles, not just the first one above threshold", async () => {
    const roles: RoleEmbeddingsFile["roles"] = [
      { roleId: "weak", title: "Weak match", embedding: [1, 0.3, 0] },
      { roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title, embedding: [1, 0, 0] },
    ];
    const loadRoleEmbeddings = vi.fn(() => embeddingsFile(roles));
    const embedTitle = vi.fn(async () => [1, 0, 0]);

    const result = await estimateExposure("an exact-direction title", { embedTitle, loadRoleEmbeddings });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.borrowedFrom.roleId).toBe(KNOWN_ROLE.id);
      expect(result.similarity).toBeCloseTo(1, 10);
    }
  });

  it("uses the real statically-imported src/data/role-embeddings.json by default, and that file is still the [] placeholder in this repo", async () => {
    const result = await estimateExposure("Underwater basket weaver");
    expect(result).toEqual({ status: "embeddings_unavailable" });
  });
});

describe("estimateExposure's default loader (statically-imported role-embeddings.json)", () => {
  afterEach(() => {
    vi.doUnmock("@/data/role-embeddings.json");
    vi.resetModules();
  });

  it("treats the [] placeholder as embeddings_unavailable", async () => {
    vi.doMock("@/data/role-embeddings.json", () => ({ default: [] }));

    const { estimateExposure: estimateExposureWithMock } = await import("@/lib/exposure-estimate");
    const result = await estimateExposureWithMock("Underwater basket weaver", { embedTitle: vi.fn() });

    expect(result).toEqual({ status: "embeddings_unavailable" });
  });

  it("treats an invalid shape (not matching RoleEmbeddingsFileSchema) as embeddings_unavailable", async () => {
    vi.doMock("@/data/role-embeddings.json", () => ({ default: { oops: "wrong shape" } }));

    const { estimateExposure: estimateExposureWithMock } = await import("@/lib/exposure-estimate");
    const result = await estimateExposureWithMock("Underwater basket weaver", { embedTitle: vi.fn() });

    expect(result).toEqual({ status: "embeddings_unavailable" });
  });

  it("uses valid statically-imported role embeddings to match a title", async () => {
    vi.doMock("@/data/role-embeddings.json", () => ({
      default: {
        model: "gemini-embedding-001",
        dimensions: 3,
        generatedAt: "2026-10-01T00:00:00.000Z",
        roles: [{ roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title, embedding: [1, 0, 0] }],
      },
    }));

    const { estimateExposure: estimateExposureWithMock } = await import("@/lib/exposure-estimate");
    const embedTitle = vi.fn(async () => [1, 0, 0]);
    const result = await estimateExposureWithMock("a near-synonym title", { embedTitle });

    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.borrowedFrom).toEqual({ roleId: KNOWN_ROLE.id, title: KNOWN_ROLE.title });
      expect(result.similarity).toBeCloseTo(1, 10);
    }
  });
});
