import { getDefaultNormalizer, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { analyzeProfile } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
import { formatMonthlyRange, formatMonthlyRm, hasRealRange, salaryForRole } from "@/lib/salary";
import { RoleCard } from "./role-card";

// Real pipeline: a profile with five of a nurse's essential skills ranks
// "nurse responsible for general care", which has 2 SDG targets and a full gap.
const nurse = CATALOGUE.occupations.find((occupation) => occupation.id === "o025")!;
const result = analyzeProfile(CATALOGUE, {
  skills: nurse.essentialSkillIds.slice(0, 5).map((skillId) => ({ skillId, level: 1 })),
  currentOccupationId: null,
  impactInterest: "health",
});
const role = { ...result.roles.find((item) => item.occupationId === "o025")!, explanation: "Why this role, in one line." };
const breakdown = result.breakdown[role.occupationId];
// Keep non-breaking spaces intact when matching salary text.
const keepNbsp = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

function renderCard(roleOverrides: Partial<typeof role> = {}) {
  return render(
    <RoleCard
      role={{ ...role, ...roleOverrides }}
      rank={1}
      total={3}
      status={breakdown.status}
      skillLinks={[]}
      targetLabels={result.targetLabels}
      chosen={false}
      onChoose={vi.fn()}
      flaggedIds={new Set()}
      onFlag={vi.fn()}
    />,
  );
}

describe("RoleCard", () => {
  it("shows only the collapsed essentials by default: rank, title, fit, reason, top SDG + N, 3 skills + N more", () => {
    renderCard();

    expect(screen.getByText(role.title)).toBeInTheDocument();
    expect(screen.getByText("#1 of 3")).toBeInTheDocument();
    expect(screen.getByText(role.explanation!)).toBeInTheDocument();
    expect(screen.getByText(`+${role.sdg.length - 1}`)).toBeInTheDocument();

    // Top 3 of 5 gap skills are visible directly; the rest sit behind "+2 more".
    expect(screen.getByText(role.gap[0].label)).toBeInTheDocument();
    expect(screen.getByText(role.gap[1].label)).toBeInTheDocument();
    expect(screen.getByText(role.gap[2].label)).toBeInTheDocument();
    expect(screen.queryByText(role.gap[3].label)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument();

    // The full "why", SDG reasons, and "Flag this" are collapsed inside Details.
    expect(screen.queryByText("SDG targets and why")).not.toBeInTheDocument();
    expect(screen.queryByText(role.sdg[0].reason)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Choose this role" })).toBeInTheDocument();
  });

  it("expands Details on click, revealing every SDG target and reason", async () => {
    const user = userEvent.setup();
    renderCard();

    const detailsButton = screen.getByRole("button", { name: "Details" });
    expect(detailsButton).toHaveAttribute("aria-expanded", "false");

    await user.click(detailsButton);

    expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("SDG targets and why")).toBeInTheDocument();
    for (const link of role.sdg) {
      expect(screen.getByText(new RegExp(link.reason.slice(0, 20)))).toBeInTheDocument();
    }
  });

  it("toggles the skills '+N more' / 'Show less' button, revealing the remaining gap skills", async () => {
    const user = userEvent.setup();
    renderCard();

    const moreButton = screen.getByRole("button", { name: "+2 more" });
    expect(moreButton).toHaveAttribute("aria-expanded", "false");

    await user.click(moreButton);

    const lessButton = screen.getByRole("button", { name: "Show less" });
    expect(lessButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(role.gap[3].label)).toBeInTheDocument();
    expect(screen.getByText(role.gap[4].label)).toBeInTheDocument();

    await user.click(lessButton);

    expect(screen.getByRole("button", { name: "+2 more" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(role.gap[3].label)).not.toBeInTheDocument();
    expect(screen.queryByText(role.gap[4].label)).not.toBeInTheDocument();
  });

  it("toggles the extra SDG tags inline via '+N' / 'Show less'", async () => {
    const user = userEvent.setup();
    renderCard();

    const extraSdgButton = screen.getByRole("button", { name: `+${role.sdg.length - 1}` });
    expect(extraSdgButton).toHaveAttribute("aria-expanded", "false");

    await user.click(extraSdgButton);

    const lessButton = screen.getByRole("button", { name: "Show less" });
    expect(lessButton).toHaveAttribute("aria-expanded", "true");
    for (const link of role.sdg.slice(1)) {
      expect(screen.getByText(`${link.target} ${result.targetLabels[link.target] ?? link.target}`)).toBeInTheDocument();
    }

    await user.click(lessButton);

    expect(screen.getByRole("button", { name: `+${role.sdg.length - 1}` })).toHaveAttribute("aria-expanded", "false");
  });

  it("shows salary data for every occupation that has it", () => {
    for (const occupation of CATALOGUE.occupations) {
      const salary = salaryForRole(occupation.id);
      if (!salary) continue;

      const { unmount } = renderCard({ occupationId: occupation.id, title: occupation.title });

      if (hasRealRange(salary)) {
        expect(salary.minMonthlyRm).toBeLessThanOrEqual(salary.maxMonthlyRm);
        expect(screen.getByText(formatMonthlyRange(salary.minMonthlyRm, salary.maxMonthlyRm), keepNbsp)).toBeInTheDocument();
        expect(formatMonthlyRange(salary.minMonthlyRm, salary.maxMonthlyRm)).not.toMatch(/ /);
        const exact = salary.rangeSourceRole?.toLowerCase() === occupation.title.toLowerCase();
        const name = exact
          ? `${salary.rangeSourceName} ${salary.rangeYear}`
          : `${salary.rangeSourceName} · ${salary.rangeSourceRole} ${salary.rangeYear}`;
        const link = screen.getByRole("link", { name });
        expect(link).toHaveAttribute("href", salary.rangeSourceUrl);
      } else {
        expect(salary.sourceType).toBe("dosm_major_group");
        expect(salary.minMonthlyRm).toBeUndefined();
        expect(screen.getByText(formatMonthlyRm(salary.avgMonthlyRm), keepNbsp)).toBeInTheDocument();
        expect(formatMonthlyRm(salary.avgMonthlyRm)).not.toMatch(/ /);
        expect(screen.getByText(`Industry average · DOSM major group ${salary.year}`)).toBeInTheDocument();
      }

      expect(screen.getByText("/month")).toBeInTheDocument();
      unmount();
    }
  });

  it("shows a fallback when salary data is not available", () => {
    renderCard({ occupationId: "unknown-occupation" });

    expect(screen.getByText("Salary data not available")).toBeInTheDocument();
    expect(screen.queryByText(/MASCO/)).not.toBeInTheDocument();
  });

  it("merges the card's sources into one 'n sources' control", async () => {
    const user = userEvent.setup();
    renderCard();

    const sourcesButton = screen.getByRole("button", { name: `${role.sources.length} sources` });
    expect(sourcesButton).toHaveAttribute("aria-expanded", "false");

    await user.click(sourcesButton);
    expect(sourcesButton).toHaveAttribute("aria-expanded", "true");
    for (const source of role.sources) {
      expect(screen.getAllByText(new RegExp(source.dataset)).length).toBeGreaterThan(0);
    }
  });
});
