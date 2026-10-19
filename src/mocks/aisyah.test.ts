import { describe, expect, it } from "vitest";
import { formatBandScore, formatSourceDate } from "@/lib/display";
import { rankRoles } from "@/lib/rank-roles";
import { MAX_INTERVIEW_TURNS, scoreBand } from "@/types/contracts";
import { AISYAH_RESULTS } from "./aisyah";

describe("Aisyah example results", () => {
  it("marks both snapshots as example data and keeps each role on that snapshot date", () => {
    for (const example of Object.values(AISYAH_RESULTS)) {
      expect(example.example).toBe(true);
      expect(example.persona.detail).toContain("Aisyah");
      expect(example.persona.basis).toContain(`${MAX_INTERVIEW_TURNS} interview answers`);
      for (const role of example.response.roles) {
        expect(role.signalsAsOf).toBe(example.response.signalsAsOf);
        expect(role.sdg.length).toBeGreaterThan(0);
        expect(role.sdg.length).toBeLessThanOrEqual(3);
        for (const link of role.sdg) {
          expect(link.subject).toEqual({ kind: "occupation", occupationId: role.occupationId });
        }
      }
      for (const link of example.skillLinks) {
        expect(link.subject.kind).toBe("skill");
      }
    }
  });

  it("re-ranks when the scenario or the signal date changes", () => {
    const today = AISYAH_RESULTS.today.response.roles;
    const prior = AISYAH_RESULTS["thirty-days-ago"].response.roles;
    const ids = (roles: typeof today, scenario: "co" | "dis" | "sup") =>
      rankRoles(roles, scenario).map((role) => role.occupationId);

    const todayCo = ids(today, "co");
    expect(todayCo).toEqual([
      "data-operations-analyst",
      "customer-experience-specialist",
      "esg-reporting-associate",
    ]);
    expect(ids(today, "dis").at(-1)).toBe("customer-experience-specialist");
    expect(ids(today, "sup")[1]).toBe("esg-reporting-associate");
    expect(ids(prior, "co")[0]).toBe("customer-experience-specialist");
    expect(ids(prior, "co")).not.toEqual(todayCo);
    expect(today.find((role) => role.robust)?.occupationId).toBe("data-operations-analyst");
  });

  it("shows the section 05 bands used on the score cards", () => {
    expect(formatBandScore(0.71)).toBe("High · 0.71");
    expect(formatBandScore(0.48)).toBe("Medium · 0.48");
    expect(scoreBand(0.48)).toBe("medium");
    expect(formatSourceDate("2026-09-01")).toBe("Sep 2026");
    expect(formatSourceDate("2026-10-19")).toBe("19 Oct 2026");
  });
});
