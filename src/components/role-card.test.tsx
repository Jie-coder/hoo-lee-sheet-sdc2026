import { getDefaultNormalizer, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { analyzeProfile } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
import { formatMonthlyRange, formatMonthlyRm, hasRealRange, salaryForRole } from "@/lib/salary";
import { RoleCard } from "./role-card";

// Real pipeline: a profile with five of a nurse's essential skills ranks
// "nurse responsible for general care", which has SDG targets and a full gap.
const nurse = CATALOGUE.occupations.find((occupation) => occupation.id === "o025")!;
const result = analyzeProfile(CATALOGUE, {
  skills: nurse.essentialSkillIds.slice(0, 5).map((skillId) => ({ skillId, level: 1 })),
  currentOccupationId: null,
  impactInterest: "health",
});
const role = { ...result.roles.find((item) => item.occupationId === "o025")!, explanation: "Why this role, in one line." };
// Keep non-breaking spaces intact when matching salary text.
const keepNbsp = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

function renderCard(roleOverrides: Partial<typeof role> = {}, isPrimary = true) {
  return render(
    <RoleCard
      role={{ ...role, ...roleOverrides }}
      rank={1}
      total={3}
      targetLabels={result.targetLabels}
      chosen={false}
      onChoose={vi.fn()}
      isPrimary={isPrimary}
    />,
  );
}

describe("RoleCard", () => {
  it("shows the ticket essentials: label, title, fit, top SDG, choose + why", () => {
    renderCard();

    expect(screen.getByText("Ticket 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: role.title })).toBeInTheDocument();
    expect(screen.getByText("skill fit")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^SDG ${role.sdg[0].target}`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose this route/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Why" })).toBeInTheDocument();
    // Skills-to-build and sources live in the Why drawer, not on the ticket face.
    expect(screen.queryByText("Skills to build")).not.toBeInTheDocument();
  });

  it("opens the Why drawer with skills to build, the demand line and sources", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Why" }));

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Skills to build")).toBeInTheDocument();
    expect(within(drawer).getByText(role.gap[0].label)).toBeInTheDocument();
    expect(within(drawer).getByText(role.explanation!)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: `${role.sources.length} sources` })).toBeInTheDocument();
  });

  it("only the primary ticket uses the Ember CTA styling", () => {
    const { unmount } = renderCard({}, true);
    expect(screen.getByRole("button", { name: /Choose this route/ })).toHaveClass("bg-sage");
    unmount();

    renderCard({}, false);
    expect(screen.getByRole("button", { name: /Choose this route/ })).not.toHaveClass("bg-sage");
  });

  it("shows salary data for every occupation that has it", () => {
    for (const occupation of CATALOGUE.occupations) {
      const salary = salaryForRole(occupation.id);
      if (!salary) continue;

      const { unmount } = renderCard({ occupationId: occupation.id, title: occupation.title });

      if (hasRealRange(salary)) {
        expect(salary.minMonthlyRm).toBeLessThanOrEqual(salary.maxMonthlyRm);
        expect(screen.getByText(formatMonthlyRange(salary.minMonthlyRm, salary.maxMonthlyRm), keepNbsp)).toBeInTheDocument();
        const exact = salary.rangeSourceRole?.toLowerCase() === occupation.title.toLowerCase();
        const name = exact
          ? `${salary.rangeSourceName} ${salary.rangeYear}`
          : `${salary.rangeSourceName} · ${salary.rangeSourceRole} ${salary.rangeYear}`;
        expect(screen.getByRole("link", { name })).toHaveAttribute("href", salary.rangeSourceUrl);
      } else {
        expect(salary.sourceType).toBe("dosm_major_group");
        expect(screen.getByText(formatMonthlyRm(salary.avgMonthlyRm), keepNbsp)).toBeInTheDocument();
        expect(
          screen.getByText(`Industry average · DOSM major group ${salary.year}`, { exact: false }),
        ).toBeInTheDocument();
      }

      expect(screen.getByText(/\/month/)).toBeInTheDocument();
      unmount();
    }
  });

  it("shows a bracketed placeholder when salary data is not available", () => {
    renderCard({ occupationId: "unknown-occupation" });

    expect(screen.getByText("[placeholder]")).toBeInTheDocument();
    expect(screen.queryByText(/MASCO/)).not.toBeInTheDocument();
  });
});
