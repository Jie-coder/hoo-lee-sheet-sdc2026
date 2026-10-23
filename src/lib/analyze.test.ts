import { describe, expect, it } from "vitest";
import { analyzeProfile, RELATED_SKILL_CREDIT } from "./analyze";
import { CATALOGUE, type Catalogue } from "./catalogue";
import { explainRole } from "./explain";
import { resolveProfileSkills } from "./profile-skills";
import { NON_RECOMMENDED_CLUSTERS, SCORING_PARAMS } from "./scoring";
import { PERSONA_IDS, PERSONAS } from "@/mocks/personas";
import { AnalyzeResponseSchema, SCENARIO_IDS } from "@/types/contracts";

function personaResult(id: (typeof PERSONA_IDS)[number]) {
  const persona = PERSONAS[id];
  const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
  const { skills } = resolveProfileSkills(CATALOGUE, id, chips);
  return analyzeProfile(CATALOGUE, { skills, currentOccupationId: persona.currentOccupationId, impactInterest: "none" });
}

/** A two-occupation catalogue small enough to check every number by hand. */
function tinyCatalogue(): Catalogue {
  const base = CATALOGUE.occupations.find((occupation) => occupation.id === "o009")!;
  return {
    ...CATALOGUE,
    skills: { a: "skill a", b: "skill b", c: "skill c", d: "skill d" },
    skillGroups: { a: "g1", b: "g1", c: "g2", d: "g3" },
    groupLabels: { g1: "group one", g2: "group two", g3: "group three" },
    signals: {},
    courses: [],
    occupations: [
      { ...base, id: "x1", title: "role one", cluster: "data_analytics", essentialSkillIds: ["a", "c"], exposure: { ...base.exposure!, value: 0.5 } },
      { ...base, id: "x2", title: "role two", cluster: "data_analytics", essentialSkillIds: ["b", "d"], exposure: { ...base.exposure!, value: 0.5 } },
    ],
  };
}

describe("analyzeProfile on the real catalogue", () => {
  it.each(PERSONA_IDS)("gives %s a valid response from catalogue rows only", (id) => {
    const result = personaResult(id);
    expect(result.roles.length).toBeGreaterThanOrEqual(SCORING_PARAMS.topN);

    // Same shape as the /api/analyze contract (augmentation is optional now).
    AnalyzeResponseSchema.parse({
      signalsAsOf: result.signalsAsOf,
      currentWork: { exposure: result.currentWork!.exposure, sources: result.currentWork!.sources },
      roles: result.roles,
    });

    const occupationIds = new Set(CATALOGUE.occupations.map((occupation) => occupation.id));
    for (const role of result.roles) {
      // Never invents a job, and never recommends the current one back.
      expect(occupationIds.has(role.occupationId)).toBe(true);
      expect(role.occupationId).not.toBe(PERSONAS[id].currentOccupationId);
      // Every gap skill is an ESCO essential skill of that role.
      const essential = new Set(CATALOGUE.occupations.find((o) => o.id === role.occupationId)!.essentialSkillIds);
      for (const gap of role.gap) expect(essential.has(gap.skillId)).toBe(true);
      // Every source is a real sources.csv row.
      for (const source of role.sources) expect(CATALOGUE.sources[source.dataset]).toBeDefined();
    }
  });

  it("gives the three personas different results", () => {
    const tops = PERSONA_IDS.map((id) => personaResult(id).roles.map((role) => role.occupationId).join(","));
    expect(new Set(tops).size).toBe(3);
  });

  it("marks robust exactly the roles in the top 3 of every scenario", () => {
    const result = personaResult("aisyah");
    for (const role of result.roles) {
      const inAll = SCENARIO_IDS.every((scenario) =>
        [...result.roles]
          .sort((a, b) => b.byScenario[scenario] - a.byScenario[scenario] || (a.occupationId < b.occupationId ? -1 : 1))
          .slice(0, 3)
          .some((item) => item.occupationId === role.occupationId),
      );
      expect(role.robust).toBe(inAll);
    }
  });
});

describe("analyzeProfile scoring rules (tiny catalogue)", () => {
  it("gives full credit for the same ESCO skill and half credit for a skill in the same ESCO group", () => {
    const result = analyzeProfile(tinyCatalogue(), {
      skills: [{ skillId: "a", level: 1 }],
      currentOccupationId: null,
      impactInterest: "none",
    });
    const one = result.roles.find((role) => role.occupationId === "x1")!;
    const two = result.roles.find((role) => role.occupationId === "x2")!;
    // x1 = {a (exact), c (missing)} -> 1/2. x2 = {b (same group as a, 0.5 credit), d (missing)} -> 0.25.
    expect(one.fit).toBeCloseTo(0.5);
    expect(RELATED_SKILL_CREDIT).toBe(0.5);
    expect(two.fit).toBeCloseTo(RELATED_SKILL_CREDIT / 2);
    expect(result.breakdown.x1).toMatchObject({ matchedSkills: 1, relatedSkills: 0, essentialSkills: 2 });
    expect(result.breakdown.x2).toMatchObject({ matchedSkills: 0, relatedSkills: 1, essentialSkills: 2 });
    // A related skill is not a gap; only d is.
    expect(two.gap.map((gap) => gap.skillId)).toEqual(["d"]);
  });

  it("credits only the top relatedSkillCap (10) related skills by importance when a role has more", () => {
    // A role with 12 essential skills, all in the user's skill group (related,
    // not exact), with distinct, descending momentum so each has a different
    // imp_s. Only the 10 with the highest imp_s get related credit; the other
    // 2 fall back to missing, even though they are "related" too.
    const base = CATALOGUE.occupations.find((occupation) => occupation.id === "o009")!;
    const cap = SCORING_PARAMS.relatedSkillCap;
    expect(cap).toBe(10);
    const ids = Array.from({ length: cap + 2 }, (_, index) => `r${String(index + 1).padStart(2, "0")}`);
    const momentum = ids.map((_, index) => (ids.length - 1 - index) / 10);
    const catalogue: Catalogue = {
      ...CATALOGUE,
      skills: { u: "user skill", ...Object.fromEntries(ids.map((id) => [id, id])) },
      skillGroups: { u: "g1", ...Object.fromEntries(ids.map((id) => [id, "g1"])) },
      groupLabels: { g1: "group one" },
      signals: Object.fromEntries(
        ids.map((id, index) => [id, { momentum: momentum[index], keywords: [], checkedOn: base.exposure!.asOf }]),
      ),
      courses: [],
      occupations: [
        {
          ...base,
          id: "y1",
          title: "capped role",
          cluster: "data_analytics",
          essentialSkillIds: ids,
          exposure: { ...base.exposure!, value: 0.5 },
        },
      ],
    };
    const result = analyzeProfile(catalogue, {
      skills: [{ skillId: "u", level: 1 }],
      currentOccupationId: null,
      impactInterest: "none",
    });
    const role = result.roles.find((r) => r.occupationId === "y1")!;
    expect(result.breakdown.y1.relatedSkills).toBe(cap);
    // The two lowest-momentum skills are the only gaps.
    expect(role.gap.map((gap) => gap.skillId).sort()).toEqual(ids.slice(cap));
    // Fit = cap skills at half related credit + 2 missing, over all essential skills.
    const imp = (m: number) => 1 * (1 + SCORING_PARAMS.lambda * Math.tanh(m));
    const weighted = momentum.slice(0, cap).reduce((sum, m) => sum + imp(m) * RELATED_SKILL_CREDIT, 0);
    const total = momentum.reduce((sum, m) => sum + imp(m), 0);
    expect(role.fit).toBeCloseTo(weighted / total, 10);
  });

  it("computes R from the formula: 0.5 F + 0.3 D + 0.2 (1 - theta E)", () => {
    const result = analyzeProfile(tinyCatalogue(), {
      skills: [{ skillId: "a", level: 1 }],
      currentOccupationId: null,
      impactInterest: "none",
    });
    const one = result.roles.find((role) => role.occupationId === "x1")!;
    const demand = SCORING_PARAMS.demandByCluster.data_analytics.co;
    expect(one.byScenario.co).toBeCloseTo(0.5 * 0.5 + 0.3 * demand + 0.2 * (1 - 1.0 * 0.5));
    expect(explainRole(one, result.breakdown.x1, "co")).toContain(`Score ${one.byScenario.co.toFixed(2)}`);
  });
});

describe("resolveProfileSkills", () => {
  it("uses the hand-checked persona mapping for CV skills, and exact ESCO labels at half weight for added ones", () => {
    const { skills, matches } = resolveProfileSkills(CATALOGUE, "aisyah", [
      { label: "Microsoft Word", selfReported: false },
      { label: "WhatsApp Business", selfReported: false },
      { label: "Use Spreadsheets Software", selfReported: true },
      { label: "spreadsheets", selfReported: true },
    ]);
    expect(matches.map((match) => match.escoLabels)).toEqual([
      ["use word processing software"],
      [],
      ["use spreadsheets software"],
      [],
    ]);
    expect(skills.map((skill) => skill.level)).toEqual([1, 0.5]);
  });

  it("agrees with each persona's unmatchedSkills, so the profile page's match count is true", () => {
    for (const id of PERSONA_IDS) {
      const persona = PERSONAS[id];
      const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
      const unmatched = resolveProfileSkills(CATALOGUE, id, chips)
        .matches.filter((match) => match.escoLabels.length === 0)
        .map((match) => match.label);
      expect(unmatched).toEqual(persona.unmatchedSkills);
    }
  });
});

describe("future routes only", () => {
  const clusterOf = new Map(CATALOGUE.occupations.map((o) => [o.id, o.cluster]));
  it.each(PERSONA_IDS)("never recommends a routine_clerical role to %s", (id) => {
    const result = personaResult(id);
    expect(result.roles.length).toBeGreaterThan(0);
    for (const role of result.roles) {
      expect(NON_RECOMMENDED_CLUSTERS.has(clusterOf.get(role.occupationId)!)).toBe(false);
    }
  });
  it("still shows a routine_clerical job as the current, at-risk work", () => {
    const result = personaResult("aisyah");
    expect(clusterOf.get(PERSONAS.aisyah.currentOccupationId)).toBe("routine_clerical");
    expect(result.currentWork).not.toBeNull();
  });
});

describe("related skill labels", () => {
  it.each(PERSONA_IDS)("lists exactly the related skills counted for %s", (id) => {
    const result = personaResult(id);
    for (const role of result.roles) {
      const breakdown = result.breakdown[role.occupationId];
      expect(breakdown.relatedSkillLabels).toHaveLength(breakdown.relatedSkills);
      expect(breakdown.relatedSkillLabels.length).toBeLessThanOrEqual(SCORING_PARAMS.relatedSkillCap);
    }
  });
});
