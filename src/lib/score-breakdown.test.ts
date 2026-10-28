import { describe, expect, it } from "vitest";

import {
  SCORING_PARAMS,
  exposureScore,
  rankScore,
  roleFitScore,
  scenarioDemand,
  scenarioRank,
  sdgInterestMatches,
  skillImportance,
  type CandidateRole,
} from "./scoring";
import {
  calibrateFit,
  fitRank,
  scoreBreakdown,
  whatIf,
  type BreakdownOptions,
} from "./score-breakdown";

const role: CandidateRole = {
  occupationId: "test_role",
  title: "Test role",
  cluster: "ai_digital",
  tasks: [
    { share: 0.6, automation: 0.7, augmentation: 0.3 },
    { share: 0.4, automation: 0.3, augmentation: 0.5 },
  ],
  essentialSkills: [
    { skillId: "s1", label: "Skill one", baseImportance: 0.5, momentum: 1, level: 1 },
    { skillId: "s2", label: "Skill two", baseImportance: 0.3, momentum: -0.5, level: 0.5 },
    { skillId: "s3", label: "Skill three", baseImportance: 0.2, momentum: 0.2, level: 0 },
  ],
  sdgLinks: [{ target: "13.3", tier: "direct" }],
};

const opts: BreakdownOptions = {
  scenario: "co",
  impactInterest: "environment",
};

describe("scoreBreakdown", () => {
  it("matches the underlying scoring primitives", () => {
    const result = scoreBreakdown(role, opts);
    const theta = SCORING_PARAMS.theta[opts.scenario];
    const expectedFit = roleFitScore(
      role.essentialSkills.map((skill) => ({
        importance: skillImportance(skill.baseImportance, skill.momentum),
        level: skill.level,
      })),
    );
    const demand = scenarioDemand(role.cluster, opts.scenario);
    const exposure = exposureScore(role.tasks);
    const sdgMatch = sdgInterestMatches(role.sdgLinks, opts.impactInterest);
    const roleMom = role.roleMomentum ?? 0;
    const trendFit = rankScore(expectedFit, roleMom);

    expect(result.fit).toBeCloseTo(expectedFit, 12);
    expect(result.demand).toBeCloseTo(demand, 12);
    expect(result.exposure).toBeCloseTo(exposure, 12);
    expect(result.theta).toBe(theta);
    expect(result.sdgMatch).toBe(sdgMatch ? 1 : 0);
    expect(result.roleMomentum).toBe(roleMom);
    expect(result.rankScore).toBeCloseTo(trendFit, 12);
    expect(result.components.trend.points).toBeCloseTo(
      SCORING_PARAMS.alpha * (trendFit - expectedFit),
      12,
    );
    expect(result.total).toBeCloseTo(
      scenarioRank({ fit: trendFit, demand, exposure, theta, sdgMatch }),
      12,
    );
  });

  it("makes component points sum to total and skill fit points sum to fit points", () => {
    const result = scoreBreakdown(role, opts);
    const componentSum =
      result.components.fit.points +
      result.components.demand.points +
      result.components.exposure.points +
      result.components.sdg.points +
      result.components.trend.points;
    const skillSum = result.skills.reduce((sum, skill) => sum + skill.fitPoints, 0);

    expect(componentSum).toBeCloseTo(result.total, 12);
    expect(result.fit).toBeLessThan(1);
    expect(skillSum).toBeCloseTo(result.components.fit.points, 12);
  });

  it("computes noTrendTotal with zero momentum so its delta is 0 and rankScore equals fit", () => {
    const zeroed = scoreBreakdown(role, { ...opts, momentumMultiplier: 0 });
    expect(zeroed.rankScore).toBeCloseTo(zeroed.fit, 12);
    expect(zeroed.noTrendTotal).toBeCloseTo(zeroed.total, 12);
    expect((zeroed.total - zeroed.noTrendTotal) * 100).toBeCloseTo(0, 12);

    const zeroMomentumRole: CandidateRole = {
      ...role,
      roleMomentum: 0,
      essentialSkills: role.essentialSkills.map((skill) => ({ ...skill, momentum: 0 })),
    };
    const flat = scoreBreakdown(zeroMomentumRole, opts);
    expect(flat.rankScore).toBeCloseTo(flat.fit, 12);
    expect(flat.noTrendTotal).toBeCloseTo(flat.total, 12);
  });

  it("applies momentumMultiplier before skillImportance", () => {
    const base = scoreBreakdown(role, opts);
    const doubled = scoreBreakdown(role, { ...opts, momentumMultiplier: 2 });

    for (let i = 0; i < base.skills.length; i += 1) {
      expect(doubled.skills[i].momentum).toBeCloseTo(base.skills[i].momentum * 2, 12);
      expect(doubled.skills[i].importance).not.toBeCloseTo(base.skills[i].importance, 12);
      expect(doubled.skills[i].momentumContribution).not.toBeCloseTo(
        base.skills[i].momentumContribution,
        12,
      );
    }
    expect(doubled.fit).not.toBeCloseTo(base.fit, 12);
    expect(doubled.total).not.toBeCloseTo(base.total, 12);
  });

  it("uses provided signals instead of each skill's momentum", () => {
    const base = scoreBreakdown(role, opts);
    const signalled = scoreBreakdown(role, {
      ...opts,
      signals: { s1: { momentum: 0 }, s2: { momentum: 2 } },
    });

    expect(signalled.skills.find((skill) => skill.skillId === "s1")?.momentum).toBe(0);
    expect(signalled.skills.find((skill) => skill.skillId === "s2")?.momentum).toBe(2);
    expect(signalled.skills.find((skill) => skill.skillId === "s3")?.momentum).toBe(0);
    expect(signalled.fit).not.toBeCloseTo(base.fit, 12);
    expect(signalled.total).not.toBeCloseTo(base.total, 12);
  });

  it("applies the role trend boost from roleMomentum and adoption", () => {
    const boosted = { ...role, roleMomentum: 1 };
    const base = scoreBreakdown(role, opts);
    const result = scoreBreakdown(boosted, opts);
    const expectedTrendFit = rankScore(base.fit, 1);

    expect(result.roleMomentum).toBe(1);
    expect(result.rankScore).toBeCloseTo(expectedTrendFit, 12);
    expect(result.components.trend.points).toBeCloseTo(
      SCORING_PARAMS.alpha * (expectedTrendFit - base.fit),
      12,
    );
    expect(result.total - base.total).toBeCloseTo(result.components.trend.points, 12);

    const moreAdoption = scoreBreakdown(boosted, { ...opts, adoption: 2 });
    expect(moreAdoption.rankScore).toBeGreaterThan(result.rankScore);
  });

  it("computes roleMomentum from signals, scaled by momentumMultiplier", () => {
    const signals = { s1: { momentum: 1 }, s2: { momentum: -0.5 } };
    const result = scoreBreakdown(role, { ...opts, signals, momentumMultiplier: 2 });

    expect(result.roleMomentum).toBeCloseTo(0.5, 12);
    expect(result.components.trend.value).toBeCloseTo(0.5, 12);
  });

  it("reports what-if deltas by rerunning scoreBreakdown with one skill added", () => {
    const before = scoreBreakdown(role, opts);
    const items = whatIf(role, opts);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const after = scoreBreakdown(
        {
          ...role,
          essentialSkills: role.essentialSkills.map((skill) =>
            skill.skillId === item.skillId
              ? { ...skill, level: SCORING_PARAMS.skillLevel.full }
              : skill,
          ),
        },
        opts,
      );
      expect(item.fitBefore).toBeCloseTo(before.fit, 12);
      expect(item.totalBefore).toBeCloseTo(before.total, 12);
      expect(item.fitAfter).toBeCloseTo(after.fit, 12);
      expect(item.totalAfter).toBeCloseTo(after.total, 12);
      expect(item.deltaPoints).toBeCloseTo((after.total - before.total) * 100, 12);
    }
  });
});

describe("calibrateFit", () => {
  it("divides raw fit by a fixed denominator", () => {
    expect(calibrateFit(0.1, 0.2)).toBeCloseTo(0.5, 12);
    expect(calibrateFit(0.2, 0.2)).toBe(1);
  });

  it("defaults to the global fixed denominator", () => {
    const denominator = SCORING_PARAMS.fitCalibrationDenominator;
    expect(calibrateFit(0.1)).toBeCloseTo(Math.min(1, 0.1 / denominator), 12);
    expect(calibrateFit(denominator * 2)).toBe(1);
  });

  it("caps at 1 when raw fit exceeds the denominator", () => {
    expect(calibrateFit(0.3, 0.2)).toBe(1);
  });

  it("returns 0 when the denominator is zero or negative", () => {
    expect(calibrateFit(0, 0)).toBe(0);
    expect(calibrateFit(0.1, 0)).toBe(0);
    expect(calibrateFit(0.1, -1)).toBe(0);
  });
});

describe("fitRank", () => {
  const fits = [
    { occupationId: "b", fit: 0.2 },
    { occupationId: "a", fit: 0.2 },
    { occupationId: "c", fit: 0.4 },
  ];

  it("ranks by fit descending then occupationId ascending (1-based)", () => {
    expect(fitRank(fits, "c")).toEqual({ rank: 1, total: 3 });
    expect(fitRank(fits, "a")).toEqual({ rank: 2, total: 3 });
    expect(fitRank(fits, "b")).toEqual({ rank: 3, total: 3 });
  });

  it("does not mutate the input", () => {
    fitRank(fits, "c");
    expect(fits.map((item) => item.occupationId)).toEqual(["b", "a", "c"]);
  });
});
