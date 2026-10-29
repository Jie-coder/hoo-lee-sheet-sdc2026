import { describe, it, expect } from "vitest";

import {
  gapCoverage,
  cohensKappa,
  isDatedSource,
  seededSample,
  passFail,
} from "./kpi";

describe("gapCoverage", () => {
  it("does not let a paid step close a gap", () => {
    const result = gapCoverage(["a", "b"], [
      { closesSkillIds: ["a"], costType: "paid" },
    ]);

    expect(result.closed).toEqual([]);
    expect(result.open).toEqual(["a", "b"]);
    expect(result.pct).toBe(0);
  });

  it("closes gaps covered by hrdcorp_claimable steps", () => {
    const result = gapCoverage(["a", "b", "c"], [
      { closesSkillIds: ["a"], costType: "hrdcorp_claimable" },
      { closesSkillIds: ["c"], costType: "free" },
    ]);

    expect(result.closed).toEqual(["a", "c"]);
    expect(result.open).toEqual(["b"]);
    expect(result.pct).toBeCloseTo(66.666, 2);
  });

  it("returns 100 percent for an empty gap", () => {
    const result = gapCoverage([], [{ closesSkillIds: ["a"], costType: "free" }]);

    expect(result.closed).toEqual([]);
    expect(result.open).toEqual([]);
    expect(result.pct).toBe(100);
  });
});

describe("cohensKappa", () => {
  it("returns kappa 1 for perfect agreement", () => {
    const labels = ["y", "n", "y", "n", "y", "n"];
    const result = cohensKappa(labels, [...labels]);

    expect(result.n).toBe(6);
    expect(result.agreement).toBe(1);
    expect(result.kappa).toBe(1);
  });

  it("matches the hand-computed textbook example", () => {
    const a = ["y", "y", "n", "n", "y", "y", "n", "y", "y", "n"];
    const b = ["y", "y", "y", "n", "y", "y", "n", "y", "y", "n"];
    const result = cohensKappa(a, b);

    // 9 of 10 agree; P(a=y)=6/10, P(b=y)=7/10, P(a=n)=4/10, P(b=n)=3/10.
    // pe = 0.6*0.7 + 0.4*0.3 = 0.54; kappa = (0.9 - 0.54) / (1 - 0.54).
    expect(result.n).toBe(10);
    expect(result.agreement).toBeCloseTo(0.9, 10);
    expect(result.kappa).toBeCloseTo(0.36 / 0.46, 10);
  });

  it("throws on length mismatch", () => {
    expect(() => cohensKappa(["y"], ["y", "n"])).toThrow();
  });

  it("throws on empty input", () => {
    expect(() => cohensKappa([], [])).toThrow();
  });
});

describe("isDatedSource", () => {
  it("rejects a source with no date", () => {
    expect(isDatedSource({ url: "https://example.com" })).toBe(false);
  });

  it("rejects a bad url", () => {
    expect(isDatedSource({ url: "not-a-url", date: "2024-01-01" })).toBe(false);
    expect(isDatedSource({ url: "ftp://example.com", date: "2024-01-01" })).toBe(
      false,
    );
  });

  it("accepts a valid http(s) url with a date", () => {
    expect(
      isDatedSource({ url: "https://example.com/a", date: "2024-01-01" }),
    ).toBe(true);
    expect(isDatedSource({ url: "http://example.com", date: "2024-01-01" })).toBe(
      true,
    );
  });
});

describe("seededSample", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it("returns the same output for the same seed", () => {
    expect(seededSample(items, 10, 42)).toEqual(seededSample(items, 10, 42));
  });

  it("differs for a different seed", () => {
    expect(seededSample(items, 10, 42)).not.toEqual(seededSample(items, 10, 43));
  });

  it("caps n at the length of the input", () => {
    expect(seededSample(items, 100, 7)).toHaveLength(items.length);
  });

  it("returns no duplicates", () => {
    const sample = seededSample(items, 10, 7);
    expect(new Set(sample).size).toBe(sample.length);
  });
});

describe("passFail", () => {
  it("passes when value meets or exceeds the target", () => {
    expect(passFail(80, 80)).toBe("PASS");
    expect(passFail(81, 80)).toBe("PASS");
  });

  it("fails when value is below the target", () => {
    expect(passFail(79, 80)).toBe("FAIL");
  });
});
