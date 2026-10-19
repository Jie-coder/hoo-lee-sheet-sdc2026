import { describe, expect, it } from "vitest";
import { MAX_INTERVIEW_TURNS } from "@/types/contracts";
import { clampTurn, isInterviewDone, normalizeTaskShares, splitTaskSharesEvenly } from "./interview";

describe("interview 5-turn cap", () => {
  it("is not done before the max turn", () => {
    for (let turn = 0; turn < MAX_INTERVIEW_TURNS; turn++) {
      expect(isInterviewDone(turn)).toBe(false);
    }
  });

  it("is done once the max turn is reached, and stays done past it", () => {
    expect(isInterviewDone(MAX_INTERVIEW_TURNS)).toBe(true);
    expect(isInterviewDone(MAX_INTERVIEW_TURNS + 1)).toBe(true);
    expect(isInterviewDone(99)).toBe(true);
  });

  it("clamps the turn number to [1, MAX_INTERVIEW_TURNS]", () => {
    expect(clampTurn(0)).toBe(1);
    expect(clampTurn(-5)).toBe(1);
    expect(clampTurn(MAX_INTERVIEW_TURNS)).toBe(MAX_INTERVIEW_TURNS);
    expect(clampTurn(MAX_INTERVIEW_TURNS + 3)).toBe(MAX_INTERVIEW_TURNS);
  });
});

describe("task share normalisation", () => {
  it("splits evenly across N tasks, summing to 1", () => {
    const shares = splitTaskSharesEvenly(4);
    expect(shares).toHaveLength(4);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(shares.every((value) => value === 0.25)).toBe(true);
  });

  it("returns an empty array for zero tasks", () => {
    expect(splitTaskSharesEvenly(0)).toEqual([]);
  });

  it("scales chip values so they sum to 1", () => {
    const normalized = normalizeTaskShares([0.4, 0.25, 0.25, 0.1]);
    expect(normalized.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(normalized[0]).toBeCloseTo(0.4);
  });

  it("falls back to an even split when every share is zero", () => {
    expect(normalizeTaskShares([0, 0, 0])).toEqual(splitTaskSharesEvenly(3));
  });
});
