import { describe, expect, it } from "vitest";

import { scoreBand } from "../types/contracts";
import {
  SCORING_PARAMS,
  augmentationScore,
  exposureScore,
  matchedSkillLevel,
  roleFitScore,
  scenarioDemand,
  scenarioRank,
  scoreRoles,
  sdgInterestMatches,
  skillGap,
  skillImportance,
  skillMomentum,
  skillsMatch,
  type CandidateRole,
  type EssentialSkillInput,
} from "./scoring";

describe("SCORING_PARAMS", () => {
  it("pins the illustrative weights from the brief", () => {
    expect(SCORING_PARAMS.alpha).toBe(0.5);
    expect(SCORING_PARAMS.beta).toBe(0.3);
    expect(SCORING_PARAMS.gamma).toBe(0.2);
    expect(SCORING_PARAMS.lambda).toBe(0.3);
    expect(SCORING_PARAMS.skillMatchCosine).toBe(0.82);
    expect(SCORING_PARAMS.sdgBonus).toBe(0.05);
    expect(SCORING_PARAMS.topN).toBe(3);
    expect(SCORING_PARAMS.gapSize).toBe(5);
    expect(SCORING_PARAMS.theta).toEqual({ co: 1, dis: 1.4, sup: 1.2 });
    expect(SCORING_PARAMS.demandByCluster.routine_clerical).toEqual({
      co: 0.45,
      dis: 0.15,
      sup: 0.25,
    });
    expect(SCORING_PARAMS.demandByCluster.ai_digital.sup).toBe(0.95);
    expect(SCORING_PARAMS.demandByCluster.human_care.dis).toBe(0.55);
  });
});

describe("exposureScore", () => {
  it("sums share times automation", () => {
    // 0.25 * 1 + 0.75 * 0.2 = 0.4
    expect(
      exposureScore([
        { share: 0.25, automation: 1 },
        { share: 0.75, automation: 0.2 },
      ]),
    ).toBeCloseTo(0.4, 10);
  });

  it("returns 0 for an empty task list", () => {
    expect(exposureScore([])).toBe(0);
  });

  it("returns 0 when every share is zero", () => {
    expect(
      exposureScore([
        { share: 0, automation: 1 },
        { share: 0, automation: 0.4 },
      ]),
    ).toBe(0);
  });

  it("ignores a zero-share task and does not rescale the others", () => {
    // 0 * 1 + 0.5 * 0.2 + 0.5 * 0.4 = 0.3. Not divided by 1.
    expect(
      exposureScore([
        { share: 0, automation: 1 },
        { share: 0.5, automation: 0.2 },
        { share: 0.5, automation: 0.4 },
      ]),
    ).toBeCloseTo(0.3, 10);
  });

  it("does not renormalize shares that fail to sum to 1", () => {
    // The image writes the sum, with (Σ w_i = 1) as a constraint.
    // 1 * 0.2 + 1 * 0.4 = 0.6, not the average 0.3.
    expect(
      exposureScore([
        { share: 1, automation: 0.2 },
        { share: 1, automation: 0.4 },
      ]),
    ).toBeCloseTo(0.6, 10);
  });
});

describe("augmentationScore", () => {
  it("sums share times augmentation", () => {
    // 0.5 * 0.2 + 0.5 * 0.6 = 0.4
    expect(
      augmentationScore([
        { share: 0.5, augmentation: 0.2 },
        { share: 0.5, augmentation: 0.6 },
      ]),
    ).toBeCloseTo(0.4, 10);
  });

  it("returns 0 for an empty task list", () => {
    expect(augmentationScore([])).toBe(0);
  });

  it("returns 0 when every share is zero", () => {
    expect(augmentationScore([{ share: 0, augmentation: 1 }])).toBe(0);
  });
});

describe("skillMomentum", () => {
  it("is the log ratio of smoothed paper counts", () => {
    // ln((9 + 1) / (4 + 1)) = ln(2)
    expect(skillMomentum(9, 4)).toBeCloseTo(Math.log(2), 12);
  });

  it("is negative when the recent window is quieter", () => {
    // ln((0 + 1) / (1 + 1)) = ln(1/2)
    expect(skillMomentum(0, 1)).toBeCloseTo(-Math.log(2), 12);
  });

  it("is zero when both windows are empty", () => {
    expect(skillMomentum(0, 0)).toBe(0);
  });
});

describe("skillImportance", () => {
  it("leaves base importance unchanged when momentum is zero", () => {
    expect(skillImportance(0.8, 0)).toBeCloseTo(0.8, 12);
  });

  it("boosts by λ tanh(m)", () => {
    // tanh(m) = 0.5, so imp = 1 * (1 + 0.3 * 0.5) = 1.15
    expect(skillImportance(1, Math.atanh(0.5))).toBeCloseTo(1.15, 10);
  });

  it("damps when momentum is negative", () => {
    // tanh(m) = -0.5, so imp = 1 * (1 - 0.15) = 0.85
    expect(skillImportance(1, Math.atanh(-0.5))).toBeCloseTo(0.85, 10);
  });

  it("saturates the boost near λ as momentum grows", () => {
    // tanh(20) ≈ 1, so imp ≈ 1 * (1 + 0.3) = 1.3
    expect(skillImportance(1, 20)).toBeCloseTo(1.3, 6);
  });
});

describe("skillsMatch", () => {
  it("uses an inclusive cosine threshold of 0.82", () => {
    expect(skillsMatch(0.82)).toBe(true);
    expect(skillsMatch(1)).toBe(true);
    expect(skillsMatch(0.819999)).toBe(false);
    expect(skillsMatch(0)).toBe(false);
  });
});

describe("matchedSkillLevel", () => {
  it("is missing when nothing is offered", () => {
    expect(matchedSkillLevel([])).toBe(0);
  });

  it("ignores a strong level that sits under the cosine threshold", () => {
    expect(matchedSkillLevel([{ cosine: 0.81, level: 1 }])).toBe(0);
  });

  it("keeps a partial match at the threshold", () => {
    expect(matchedSkillLevel([{ cosine: 0.82, level: 0.5 }])).toBe(0.5);
  });

  it("keeps the highest level among skills that match", () => {
    expect(
      matchedSkillLevel([
        { cosine: 0.9, level: 0.5 },
        { cosine: 0.82, level: 1 },
        { cosine: 0.2, level: 1 },
      ]),
    ).toBe(1);
  });
});

describe("roleFitScore", () => {
  it("is the importance-weighted average of h_s", () => {
    // (0.8 * 1 + 0.4 * 0.5 + 0.2 * 0) / (0.8 + 0.4 + 0.2) = 1 / 1.4
    expect(
      roleFitScore([
        { importance: 0.8, level: 1 },
        { importance: 0.4, level: 0.5 },
        { importance: 0.2, level: 0 },
      ]),
    ).toBeCloseTo(1 / 1.4, 12);
  });

  it("counts a missing skill in the denominator", () => {
    // (1 * 1 + 1 * 0) / 2 = 0.5
    expect(
      roleFitScore([
        { importance: 1, level: 1 },
        { importance: 1, level: 0 },
      ]),
    ).toBeCloseTo(0.5, 12);
  });

  it("returns 0 when there are no essential skills", () => {
    expect(roleFitScore([])).toBe(0);
  });

  it("returns 0 when every essential skill is missing", () => {
    expect(
      roleFitScore([
        { importance: 0.5, level: 0 },
        { importance: 0.2, level: 0 },
      ]),
    ).toBe(0);
  });

  it("returns 0 when every importance is zero", () => {
    expect(roleFitScore([{ importance: 0, level: 1 }])).toBe(0);
  });
});

describe("scenarioDemand", () => {
  it("reads the page 7 table", () => {
    expect(scenarioDemand("green_sustainability", "co")).toBe(0.6);
    expect(scenarioDemand("data_analytics", "dis")).toBe(0.7);
    expect(scenarioDemand("human_care", "sup")).toBe(0.6);
  });
});

describe("scenarioRank", () => {
  it("is α F + β D + γ (1 − θ E)", () => {
    // 0.5 * 0.5 + 0.3 * 0.75 + 0.2 * (1 - 1 * 0.4) = 0.25 + 0.225 + 0.12
    expect(
      scenarioRank({ fit: 0.5, demand: 0.75, exposure: 0.4, theta: 1 }),
    ).toBeCloseTo(0.595, 10);
  });

  it("adds the SDG bonus once", () => {
    const base = scenarioRank({ fit: 0.5, demand: 0.75, exposure: 0.4, theta: 1 });
    const withBonus = scenarioRank({
      fit: 0.5,
      demand: 0.75,
      exposure: 0.4,
      theta: 1,
      sdgMatch: true,
    });
    expect(withBonus - base).toBeCloseTo(0.05, 12);
    expect(withBonus).toBeCloseTo(0.645, 10);
  });

  it("punishes exposure more under displacement", () => {
    // θ = 1.4, D = 0.15 (routine clerical, age of displacement)
    // 0.5 * 0.5 + 0.3 * 0.15 + 0.2 * (1 - 1.4 * 0.4) = 0.25 + 0.045 + 0.088
    expect(
      scenarioRank({ fit: 0.5, demand: 0.15, exposure: 0.4, theta: 1.4 }),
    ).toBeCloseTo(0.383, 10);
  });
});

describe("sdgInterestMatches", () => {
  it("matches direct and supporting links on the interest's goals", () => {
    expect(sdgInterestMatches([{ target: "11.3", tier: "direct" }], "community")).toBe(true);
    expect(sdgInterestMatches([{ target: "4.4", tier: "supporting" }], "education")).toBe(true);
    expect(sdgInterestMatches([{ target: "3.8", tier: "direct" }], "health")).toBe(true);
    expect(sdgInterestMatches([{ target: "13.3", tier: "direct" }], "environment")).toBe(true);
  });

  it("ignores inferred links, other goals, and interest none", () => {
    expect(sdgInterestMatches([{ target: "11.3", tier: "inferred" }], "community")).toBe(false);
    expect(sdgInterestMatches([{ target: "13.3", tier: "direct" }], "community")).toBe(false);
    expect(sdgInterestMatches([{ target: "4.4", tier: "direct" }], "none")).toBe(false);
    expect(
      sdgInterestMatches(
        [
          { target: "8.6", tier: "direct" },
          { target: "11.1", tier: "supporting" },
        ],
        "community",
      ),
    ).toBe(true);
  });
});

describe("skillGap", () => {
  const skills: EssentialSkillInput[] = [
    { skillId: "a", label: "A", baseImportance: 0.5, momentum: 0, level: 0 },
    { skillId: "b", label: "B", baseImportance: 0.9, momentum: 0, level: 0 },
    { skillId: "c", label: "C", baseImportance: 0.2, momentum: 0, level: 1 },
    { skillId: "d", label: "D", baseImportance: 0.8, momentum: 0, level: 0.5 },
    { skillId: "e", label: "E", baseImportance: 0.7, momentum: 0, level: 0 },
    { skillId: "f", label: "F", baseImportance: 0.6, momentum: 0, level: 0 },
    { skillId: "g", label: "G", baseImportance: 0.4, momentum: 0, level: 0 },
    { skillId: "h", label: "H", baseImportance: 0.3, momentum: 0, level: 0 },
  ];

  it("keeps the five missing skills with the highest importance", () => {
    expect(skillGap(skills).map((skill) => skill.skillId)).toEqual(["b", "e", "f", "a", "g"]);
  });

  it("leaves out skills the user has in full or in part", () => {
    const ids = skillGap(skills).map((skill) => skill.skillId);
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
  });

  it("breaks equal importance by skill id", () => {
    const tied: EssentialSkillInput[] = [
      { skillId: "zeta", label: "Zeta", baseImportance: 0.55, momentum: 0, level: 0 },
      { skillId: "alpha", label: "Alpha", baseImportance: 0.55, momentum: 0, level: 0 },
    ];
    expect(skillGap(tied).map((skill) => skill.skillId)).toEqual(["alpha", "zeta"]);
  });

  it("returns an empty gap when nothing is missing", () => {
    expect(skillGap([])).toEqual([]);
    expect(
      skillGap([{ skillId: "a", label: "A", baseImportance: 1, momentum: 0, level: 1 }]),
    ).toEqual([]);
  });
});

function role(partial: CandidateRole): CandidateRole {
  return partial;
}

describe("scoreRoles", () => {
  // Exposure is 0 unless a role sets tasks otherwise.
  // R = 0.5 F + 0.3 D + 0.2 (1 − θ E), no SDG links.
  const robust = role({
    occupationId: "robust",
    title: "Robust",
    cluster: "data_analytics",
    tasks: [{ share: 1, automation: 0, augmentation: 0 }],
    essentialSkills: [
      { skillId: "held", label: "Held", baseImportance: 1, momentum: 0, level: 1 },
    ],
    sdgLinks: [],
  });
  const steady = role({
    occupationId: "steady",
    title: "Steady",
    cluster: "green_sustainability",
    tasks: [{ share: 1, automation: 0, augmentation: 0 }],
    essentialSkills: [
      { skillId: "held", label: "Held", baseImportance: 0.7, momentum: 0, level: 1 },
      { skillId: "miss", label: "Miss", baseImportance: 0.3, momentum: 0, level: 0 },
    ],
    sdgLinks: [],
  });
  const swap = role({
    occupationId: "swap",
    title: "Swap",
    cluster: "routine_clerical",
    tasks: [{ share: 1, automation: 1, augmentation: 0 }],
    essentialSkills: [
      { skillId: "held", label: "Held", baseImportance: 0.9, momentum: 0, level: 1 },
      { skillId: "miss", label: "Miss", baseImportance: 0.1, momentum: 0, level: 0 },
    ],
    sdgLinks: [],
  });
  const weak = role({
    occupationId: "weak",
    title: "Weak",
    cluster: "ai_digital",
    tasks: [{ share: 1, automation: 0, augmentation: 0 }],
    essentialSkills: [
      { skillId: "held", label: "Held", baseImportance: 0.3, momentum: 0, level: 1 },
      { skillId: "miss", label: "Miss", baseImportance: 0.7, momentum: 0, level: 0 },
    ],
    sdgLinks: [],
  });

  it("marks only roles that stay in the top 3 of every scenario", () => {
    // Hand ranks, fit = importance-weighted h, E from the single task:
    // robust: F=1, E=0, data.  co 0.925, dis 0.91, sup 0.97
    // steady: F=0.7, E=0, green. co 0.73, dis 0.745, sup 0.76
    // swap: F=0.9, E=1, clerical. co 0.585, dis 0.415, sup 0.485
    // weak: F=0.3, E=0, ai. co 0.575, dis 0.545, sup 0.635
    // top 3 co: robust, steady, swap. dis: robust, steady, weak. sup: robust, steady, weak.
    const scored = scoreRoles([weak, swap, robust, steady], "none");
    expect(scored.map((item) => item.occupationId)).toEqual([
      "robust",
      "steady",
      "swap",
      "weak",
    ]);
    expect(scored.find((item) => item.occupationId === "robust")).toMatchObject({
      robust: true,
      fit: 1,
      exposure: 0,
    });
    expect(scored.find((item) => item.occupationId === "robust")?.byScenario.co).toBeCloseTo(
      0.925,
      10,
    );
    expect(scored.find((item) => item.occupationId === "robust")?.byScenario.dis).toBeCloseTo(
      0.91,
      10,
    );
    expect(scored.find((item) => item.occupationId === "steady")?.robust).toBe(true);
    expect(scored.find((item) => item.occupationId === "swap")?.robust).toBe(false);
    expect(scored.find((item) => item.occupationId === "weak")?.robust).toBe(false);
  });

  it("drops a role that is outside the top 3 in every scenario", () => {
    const scored = scoreRoles([weak, swap, robust, steady], "none");
    // All four appear above. A fifth, strictly worse than weak on every scenario, drops out.
    const extra = role({
      ...weak,
      occupationId: "extra",
      title: "Extra",
      essentialSkills: [
        { skillId: "held", label: "Held", baseImportance: 0.1, momentum: 0, level: 1 },
        { skillId: "miss", label: "Miss", baseImportance: 0.9, momentum: 0, level: 0 },
      ],
    });
    const withExtra = scoreRoles([extra, weak, swap, robust, steady], "none");
    expect(withExtra.map((item) => item.occupationId)).not.toContain("extra");
    expect(scored).toHaveLength(4);
  });

  it("treats a single candidate as robust", () => {
    const scored = scoreRoles([robust], "none");
    expect(scored).toHaveLength(1);
    expect(scored[0]?.robust).toBe(true);
  });

  it("returns nothing when there are no candidates", () => {
    expect(scoreRoles([], "community")).toEqual([]);
  });

  it("is deterministic for the same input, including a reversed list", () => {
    const forward = scoreRoles([robust, steady, swap, weak], "none");
    const again = scoreRoles([robust, steady, swap, weak], "none");
    const reversed = scoreRoles([weak, swap, steady, robust], "none");
    expect(again).toEqual(forward);
    expect(reversed).toEqual(forward);
  });
});

describe("Aisyah example", () => {
  // Illustrative example data for the demo persona Aisyah, 23, admin clerk.
  // Invented task shares and skill figures, not a measured profile. The
  // numbers are picked so exposure lands in Medium and augmentation in High,
  // which is the shape of the demo script.
  const tasks = [
    { share: 0.4, automation: 0.8, augmentation: 0.8 },
    { share: 0.25, automation: 0.4, augmentation: 0.7 },
    { share: 0.2, automation: 0.7, augmentation: 0.6 },
    { share: 0.15, automation: 0.5, augmentation: 0.75 },
  ];

  it("scores her current work and a made-up next role", () => {
    // E = 0.4*0.8 + 0.25*0.4 + 0.2*0.7 + 0.15*0.5 = 0.32 + 0.1 + 0.14 + 0.075
    expect(exposureScore(tasks)).toBeCloseTo(0.635, 10);
    // G = 0.4*0.8 + 0.25*0.7 + 0.2*0.6 + 0.15*0.75 = 0.32 + 0.175 + 0.12 + 0.1125
    expect(augmentationScore(tasks)).toBeCloseTo(0.7275, 10);
    expect(scoreBand(exposureScore(tasks))).toBe("medium");
    expect(scoreBand(augmentationScore(tasks))).toBe("high");

    // Excel matches spreadsheets. Data visualisation does not clear 0.82.
    const spreadsheetLevel = matchedSkillLevel([{ cosine: 0.91, level: 1 }]);
    const visualisationLevel = matchedSkillLevel([{ cosine: 0.4, level: 1 }]);
    expect(spreadsheetLevel).toBe(1);
    expect(visualisationLevel).toBe(0);

    // Visualisation momentum ln((8+1)/(2+1)) = ln(3), tanh(ln(3)) = 0.8,
    // importance = 1 * (1 + 0.3 * 0.8) = 1.24. SQL is flat at base 0.5.
    const visualisationMomentum = skillMomentum(8, 2);
    expect(visualisationMomentum).toBeCloseTo(Math.log(3), 12);
    expect(skillImportance(1, visualisationMomentum)).toBeCloseTo(1.24, 8);

    const analyst: CandidateRole = {
      occupationId: "data-operations-analyst",
      title: "Data operations analyst",
      cluster: "data_analytics",
      tasks: [
        { share: 0.6, automation: 0.3, augmentation: 0.7 },
        { share: 0.4, automation: 0.5, augmentation: 0.5 },
      ],
      essentialSkills: [
        {
          skillId: "spreadsheets",
          label: "Spreadsheets",
          baseImportance: 0.8,
          momentum: 0,
          level: spreadsheetLevel,
        },
        {
          skillId: "data-visualisation",
          label: "Data visualisation",
          baseImportance: 1,
          momentum: visualisationMomentum,
          level: visualisationLevel,
        },
        {
          skillId: "sql",
          label: "SQL",
          baseImportance: 0.5,
          momentum: 0,
          level: 0,
        },
      ],
      // Goal 11 is the illustrative community match. 8.6 does not match it.
      sdgLinks: [
        { target: "11.1", tier: "direct" },
        { target: "8.6", tier: "direct" },
      ],
    };
    const supervisor: CandidateRole = {
      occupationId: "admin-supervisor",
      title: "Admin supervisor",
      cluster: "routine_clerical",
      tasks: [{ share: 1, automation: 0.6, augmentation: 0.2 }],
      essentialSkills: [
        {
          skillId: "customer-email",
          label: "Customer email",
          baseImportance: 0.4,
          momentum: 0,
          level: 1,
        },
        {
          skillId: "supervision",
          label: "Supervision",
          baseImportance: 0.6,
          momentum: 0,
          level: 0,
        },
      ],
      sdgLinks: [{ target: "8.6", tier: "direct" }],
    };

    const scored = scoreRoles([supervisor, analyst], "community");
    const analystScore = scored.find((item) => item.occupationId === "data-operations-analyst");
    const supervisorScore = scored.find((item) => item.occupationId === "admin-supervisor");

    // Fit = 0.8 * 1 / (0.8 + 1.24 + 0.5) = 0.8 / 2.54
    expect(analystScore?.fit).toBeCloseTo(0.8 / 2.54, 8);
    // E_r = 0.6 * 0.3 + 0.4 * 0.5 = 0.38
    expect(analystScore?.exposure).toBeCloseTo(0.38, 10);
    expect(analystScore?.gap.map((skill) => skill.skillId)).toEqual([
      "data-visualisation",
      "sql",
    ]);
    expect(analystScore?.gap[0]?.importance).toBeCloseTo(1.24, 8);

    // R_co = 0.5 * fit + 0.3 * 0.75 + 0.2 * (1 - 1 * 0.38) + 0.05
    const analystFit = 0.8 / 2.54;
    expect(analystScore?.byScenario.co).toBeCloseTo(
      0.5 * analystFit + 0.3 * 0.75 + 0.2 * (1 - 0.38) + 0.05,
      8,
    );
    // Supervisor has no community goal, so no bonus.
    // R_co = 0.5 * 0.4 + 0.3 * 0.45 + 0.2 * (1 - 1 * 0.6) = 0.415
    expect(supervisorScore?.fit).toBeCloseTo(0.4, 10);
    expect(supervisorScore?.byScenario.co).toBeCloseTo(0.415, 10);
    expect(analystScore?.byScenario.co).toBeGreaterThan(supervisorScore?.byScenario.co ?? 0);
    // Two candidates are both inside every top 3.
    expect(analystScore?.robust).toBe(true);
    expect(supervisorScore?.robust).toBe(true);
    expect(scored.map((item) => item.occupationId)).toEqual([
      "data-operations-analyst",
      "admin-supervisor",
    ]);
  });
});
