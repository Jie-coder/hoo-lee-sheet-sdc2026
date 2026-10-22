import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { embeddingMatchCache, mapSkillsToEsco } from "@/lib/skill-match";

const KNOWN_LABEL = Object.values(CATALOGUE.skills)[0];

beforeEach(() => {
  embeddingMatchCache.clear();
});

describe("mapSkillsToEsco", () => {
  it("matches a raw skill that is an exact (case-insensitive) ESCO label, without touching the embedding tier", async () => {
    const embedTexts = vi.fn();
    const matchEmbedding = vi.fn();
    const result = await mapSkillsToEsco([KNOWN_LABEL.toUpperCase()], { embedTexts, matchEmbedding });

    expect(result).toEqual([{ label: KNOWN_LABEL, matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
    expect(matchEmbedding).not.toHaveBeenCalled();
  });

  it("matches a raw skill through the synonym list before falling back to embeddings", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco(["Excel"], { embedTexts });

    expect(result).toEqual([{ label: "use spreadsheets software", matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("only sends the skills that cleared neither tier to embedTexts, in order", async () => {
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const matchEmbedding = vi.fn(async () => ({ label: "some esco label", similarity: 0.9 }));

    const result = await mapSkillsToEsco([KNOWN_LABEL, "Excel", "Some Weird Tool"], { embedTexts, matchEmbedding });

    expect(embedTexts).toHaveBeenCalledTimes(1);
    expect(embedTexts).toHaveBeenCalledWith(["Some Weird Tool"]);
    expect(result).toEqual([
      { label: KNOWN_LABEL, matched: true },
      { label: "use spreadsheets software", matched: true },
      { label: "some esco label", matched: true },
    ]);
  });

  it("leaves a skill below the match threshold as free text", async () => {
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const matchEmbedding = vi.fn(async () => null); // the default implementation returns null under the cosine threshold too

    const result = await mapSkillsToEsco(["Underwater basket weaving"], { embedTexts, matchEmbedding });

    expect(result).toEqual([{ label: "Underwater basket weaving", matched: false }]);
  });

  it("falls back to free text for every pending skill when the embedding call hits a quota (429)", async () => {
    const quotaError = Object.assign(new Error("Quota exceeded"), { statusCode: 429 });
    const embedTexts = vi.fn(async () => {
      throw quotaError;
    });
    const matchEmbedding = vi.fn();

    const result = await mapSkillsToEsco(["Rare Skill A", "Rare Skill B"], { embedTexts, matchEmbedding });

    expect(result).toEqual([
      { label: "Rare Skill A", matched: false },
      { label: "Rare Skill B", matched: false },
    ]);
    expect(matchEmbedding).not.toHaveBeenCalled();
  });

  it("caches an embedding-tier result so the same skill text is not re-embedded", async () => {
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const matchEmbedding = vi.fn(async () => ({ label: "some esco label", similarity: 0.9 }));

    await mapSkillsToEsco(["Some Weird Tool"], { embedTexts, matchEmbedding });
    const second = await mapSkillsToEsco(["some weird tool"], { embedTexts, matchEmbedding });

    expect(embedTexts).toHaveBeenCalledTimes(1);
    expect(second).toEqual([{ label: "some esco label", matched: true }]);
  });
});
