import { describe, expect, it } from "vitest";
import catalogueJson from "@/data/catalogue.json";
import { CATALOGUE } from "./catalogue";
import type { Catalogue } from "./catalogue";
import {
  buildRadar,
  countUnclearLabels,
  displayDirection,
  FLAT_MOMENTUM,
  keywordMomentumSE,
  MOMENTUM_Z95,
  percentChange,
  skillMomentumBand,
} from "./radar";
import type { MomentumBand } from "./radar";
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

describe("buildRadar on a live snapshot", () => {
  const live = structuredClone(catalogueJson) as unknown as Catalogue;
  for (const signal of Object.values(live.signals)) signal.momentum += 0.3;
  for (const keyword of live.keywords.today) {
    keyword.recent += 50;
    keyword.previous += 50;
  }
  const radar = buildRadar(live, "today")!;

  it("centres every band on the skill's live momentum, not the keyword mean", () => {
    const skills = [...radar.rising, ...radar.steady, ...radar.declining];
    for (const skill of skills) {
      expect(skill.band).not.toBeNull();
      expect(skill.band!.momentum).toBe(skill.momentum);
      const se =
        Math.sqrt(
          skill.keywords.reduce(
            (sum, keyword) => sum + keywordMomentumSE(keyword.recent, keyword.previous) ** 2,
            0,
          ),
        ) / skill.keywords.length;
      expect(skill.band!.se).toBeCloseTo(se, 12);
      expect(skill.band!.low).toBeCloseTo(skill.momentum - MOMENTUM_Z95 * se, 12);
      expect(skill.band!.high).toBeCloseTo(skill.momentum + MOMENTUM_Z95 * se, 12);
    }
    expect(
      skills.some((skill) => {
        const mean =
          skill.keywords.reduce(
            (sum, keyword) => sum + skillMomentum(keyword.recent, keyword.previous),
            0,
          ) / skill.keywords.length;
        return Math.abs(skill.momentum - mean) > 1e-9;
      }),
    ).toBe(true);
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

describe("displayDirection", () => {
  const band = (crossesZero: boolean): MomentumBand => ({
    momentum: crossesZero ? 0.01 : 0.2,
    se: 0.1,
    low: crossesZero ? -0.19 : 0.1,
    high: crossesZero ? 0.21 : 0.3,
    crossesZero,
  });

  it("shows a rising skill as unclear when its band crosses zero", () => {
    expect(displayDirection("rising", band(true))).toBe("unclear");
  });

  it("shows a declining skill as unclear when its band crosses zero", () => {
    expect(displayDirection("declining", band(true))).toBe("unclear");
  });

  it("never changes flat, even when its band crosses zero", () => {
    expect(displayDirection("flat", band(true))).toBe("flat");
  });

  it("keeps rising when its band does not cross zero", () => {
    expect(displayDirection("rising", band(false))).toBe("rising");
  });

  it("leaves the direction unchanged when there is no band", () => {
    expect(displayDirection("rising", null)).toBe("rising");
    expect(displayDirection("declining", null)).toBe("declining");
  });
});

describe("countUnclearLabels on the real catalogue", () => {
  it("counts the rising/declining skills whose band crosses zero", () => {
    expect(countUnclearLabels(buildRadar(CATALOGUE, "today")!)).toEqual({ changed: 5, total: 6 });
  });
});

describe("percentChange", () => {
  it("formats the change between the two windows", () => {
    expect(percentChange({ recent: 40, previous: 31 })).toBe("+29%");
    expect(percentChange({ recent: 69, previous: 102 })).toBe("−32%");
    expect(percentChange({ recent: 423, previous: 424 })).toBe("±0%");
  });
});
