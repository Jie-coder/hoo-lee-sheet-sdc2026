import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./catalogue";
import {
  buildRadar,
  FLAT_MOMENTUM,
  keywordMomentumSE,
  MOMENTUM_Z95,
  percentChange,
  skillMomentumBand,
} from "./radar";
import { skillMomentum } from "./scoring";

describe("buildRadar on the real catalogue", () => {
  const today = buildRadar(CATALOGUE, "today")!;
  const prior = buildRadar(CATALOGUE, "prior")!;

  it("dates each snapshot and shows its own 90-day windows", () => {
    expect(today.asOf).toBe(CATALOGUE.signalsAsOf);
    expect(prior.asOf).toBe(CATALOGUE.priorSignalsAsOf);
    expect(today.window.recent.end).toBe(today.asOf);
    expect(prior.window.recent.end).toBe(prior.asOf);
  });

  it("sorts skills into rising, falling and steady by the ±10% band, with a checkable source on every keyword", () => {
    for (const radar of [today, prior]) {
      for (const skill of radar.rising) expect(skill.momentum).toBeGreaterThan(FLAT_MOMENTUM);
      for (const skill of radar.declining) expect(skill.momentum).toBeLessThan(-FLAT_MOMENTUM);
      for (const skill of radar.steady) expect(Math.abs(skill.momentum)).toBeLessThanOrEqual(FLAT_MOMENTUM);
      for (const skill of [...radar.rising, ...radar.declining]) {
        expect(skill.keywords.length).toBeGreaterThan(0);
        for (const keyword of skill.keywords) {
          expect(keyword.enough).toBe(true);
          expect(keyword.url).toMatch(/^https:\/\/export\.arxiv\.org\/api\/query\?/);
        }
      }
    }
  });

  it("never uses a keyword with too few papers, but lists it", () => {
    const small = today.tooSmall.map((keyword) => keyword.keyword);
    expect(small).toContain("robotic process automation");
    for (const skill of [...today.rising, ...today.declining, ...today.steady]) {
      for (const keyword of skill.keywords) expect(small).not.toContain(keyword.keyword);
    }
  });

  it("only rates roles that have at least one essential skill with a signal, and says how many", () => {
    for (const role of [...today.risingRoles, ...today.decliningRoles]) {
      expect(role.signalSkills.length).toBeGreaterThan(0);
      expect(role.signalSkills.length).toBeLessThanOrEqual(role.essentialSkills);
    }
    const rated = new Set(
      CATALOGUE.occupations.filter((occupation) => occupation.essentialSkillIds.some((id) => CATALOGUE.signals[id])).map((o) => o.id),
    );
    expect(today.rolesWithoutSignal).toBe(CATALOGUE.occupations.length - rated.size);
  });

  it("changes when the trend data changes (the toggle moves the radar)", () => {
    const labels = (radar: typeof today) => radar.rising.map((skill) => skill.label).join();
    expect(labels(today)).not.toBe(labels(prior));
  });

  it("gives every skill a band centred on its momentum", () => {
    for (const skill of [...today.rising, ...today.declining, ...today.steady]) {
      expect(skill.band).not.toBeNull();
      expect(Math.abs(skill.band!.momentum - skill.momentum)).toBeLessThan(1e-9);
    }
  });
});

describe("keywordMomentumSE", () => {
  it("uses the delta-method standard error for Poisson counts", () => {
    expect(keywordMomentumSE(45, 46)).toBeCloseTo(Math.sqrt(1 / 46 + 1 / 47), 12);
  });
});

describe("skillMomentumBand", () => {
  it("is symmetric around the momentum", () => {
    const band = skillMomentumBand([{ recent: 45, previous: 46 }])!;
    expect(band.momentum).toBeCloseTo(skillMomentum(45, 46), 12);
    expect(band.high - band.momentum).toBeCloseTo(band.momentum - band.low, 12);
    expect(band.high - band.momentum).toBeCloseTo(MOMENTUM_Z95 * band.se, 12);
  });

  it("averages multiple keywords and combines their variances", () => {
    const keywords = [
      { recent: 45, previous: 46 },
      { recent: 120, previous: 90 },
    ];
    const band = skillMomentumBand(keywords)!;
    const expectedMomentum =
      (skillMomentum(45, 46) + skillMomentum(120, 90)) / 2;
    const expectedSE =
      Math.sqrt(keywordMomentumSE(45, 46) ** 2 + keywordMomentumSE(120, 90) ** 2) / 2;
    expect(band.momentum).toBeCloseTo(expectedMomentum, 12);
    expect(band.se).toBeCloseTo(expectedSE, 12);
    expect(band.low).toBeCloseTo(expectedMomentum - MOMENTUM_Z95 * expectedSE, 12);
    expect(band.high).toBeCloseTo(expectedMomentum + MOMENTUM_Z95 * expectedSE, 12);
  });

  it("returns null for no keywords", () => {
    expect(skillMomentumBand([])).toBeNull();
  });
});

describe("percentChange", () => {
  it("formats the change between the two windows", () => {
    expect(percentChange({ recent: 40, previous: 31 })).toBe("+29%");
    expect(percentChange({ recent: 69, previous: 102 })).toBe("−32%");
    expect(percentChange({ recent: 423, previous: 424 })).toBe("±0%");
  });
});
