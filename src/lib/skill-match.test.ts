import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import { CV_SKILL_MATCH_COSINE, embeddingMatchCache, mapSkillsToEsco } from "@/lib/skill-match";

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

  it("matches WhatsApp Business to the digital communication skill via the synonym list", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco(["WhatsApp Business"], { embedTexts });

    expect(result).toEqual([{ label: "digital communication and collaboration", matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("matches Google Sheets to the same spreadsheets skill as Excel via the synonym list", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco(["Google Sheets"], { embedTexts });

    expect(result).toEqual([{ label: "use spreadsheets software", matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("matches Salesforce to the CRM skill via the synonym list", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco(["Salesforce"], { embedTexts });

    expect(result).toEqual([{ label: "customer relationship management", matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("matches AutoCount to the same accounting skill as SQL Accounting via the synonym list", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco(["AutoCount"], { embedTexts });

    expect(result).toEqual([{ label: "use accounting systems", matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("strips a trailing parenthetical qualifier before the exact-match tier", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco([`${KNOWN_LABEL} (basic)`], { embedTexts });

    expect(result).toEqual([{ label: KNOWN_LABEL, matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("strips a trailing parenthetical qualifier before the synonym tier", async () => {
    const embedTexts = vi.fn();
    const result = await mapSkillsToEsco(["Microsoft Excel (VLOOKUP, pivot tables)"], { embedTexts });

    expect(result).toEqual([{ label: "use spreadsheets software", matched: true }]);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("keeps the original text, qualifier included, for the embedding tier and as the unmatched label", async () => {
    const raw = "Some Weird Tool (advanced)";
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const matchEmbedding = vi.fn(async () => null);

    const result = await mapSkillsToEsco([raw], { embedTexts, matchEmbedding });

    expect(embedTexts).toHaveBeenCalledWith([raw]);
    expect(result).toEqual([{ label: raw, matched: false }]);
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

  it("leaves a skill free text when the Supabase RPC has no rows", async () => {
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const matchEmbedding = vi.fn(async () => null);

    const result = await mapSkillsToEsco(["Underwater basket weaving"], { embedTexts, matchEmbedding });

    expect(result).toEqual([{ label: "Underwater basket weaving", matched: false }]);
  });

  it("applies CV_SKILL_MATCH_COSINE itself, leaving a sub-threshold raw hit as free text", async () => {
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const belowThreshold = { label: "some esco label", similarity: CV_SKILL_MATCH_COSINE - 0.01 };
    const matchEmbedding = vi.fn(async () => belowThreshold);
    const onEmbeddingMatch = vi.fn();

    const result = await mapSkillsToEsco(["Underwater basket weaving"], { embedTexts, matchEmbedding, onEmbeddingMatch });

    expect(result).toEqual([{ label: "Underwater basket weaving", matched: false }]);
    expect(onEmbeddingMatch).toHaveBeenCalledWith("Underwater basket weaving", belowThreshold);
  });

  it("passes the raw top hit to onEmbeddingMatch even when it matches", async () => {
    const embedTexts = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const topHit = { label: "some esco label", similarity: 0.9 };
    const matchEmbedding = vi.fn(async () => topHit);
    const onEmbeddingMatch = vi.fn();

    await mapSkillsToEsco(["Some Weird Tool"], { embedTexts, matchEmbedding, onEmbeddingMatch });

    expect(onEmbeddingMatch).toHaveBeenCalledWith("Some Weird Tool", topHit);
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
