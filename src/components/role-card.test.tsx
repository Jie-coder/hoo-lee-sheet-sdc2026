import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { analyzeProfile } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
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

function renderCard() {
  return render(
    <RoleCard
      role={role}
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

  it("expanding the skills '+N more' disclosure reveals the remaining gap skills", async () => {
    const user = userEvent.setup();
    renderCard();

    const moreButton = screen.getByRole("button", { name: "+2 more" });
    expect(moreButton).toHaveAttribute("aria-expanded", "false");

    await user.click(moreButton);

    expect(moreButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(role.gap[3].label)).toBeInTheDocument();
    expect(screen.getByText(role.gap[4].label)).toBeInTheDocument();
  });

  it("merges the card's sources into one 'n sources' control", async () => {
    const user = userEvent.setup();
    renderCard();

    const sourcesButton = screen.getByRole("button", { name: `${role.sources.length} sources` });
    expect(sourcesButton).toHaveAttribute("aria-expanded", "false");

    await user.click(sourcesButton);
    expect(sourcesButton).toHaveAttribute("aria-expanded", "true");
    for (const source of role.sources) {
      expect(screen.getByText(new RegExp(source.dataset))).toBeInTheDocument();
    }
  });
});
