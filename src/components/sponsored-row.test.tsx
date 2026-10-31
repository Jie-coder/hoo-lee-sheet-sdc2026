import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n-messages";
import { SPONSORED_COURSES } from "@/lib/sponsored";
import { SponsoredRow } from "./pathway-view";

describe("SponsoredRow", () => {
  it("renders the Sponsored label, reason and the 'Why am I seeing this?' disclosure, and is print-hidden", () => {
    const t = ((key: never, vars?: Record<string, string>) => translate("en", key, vars)) as never;
    const { container } = render(
      <SponsoredRow t={t} pick={{ stopIndex: 3, skillId: "s", course: SPONSORED_COURSES[0] }} skillLabel="statistics" refStop={4} refTitle="Basic Statistics" refCost="Free" />,
    );
    expect(screen.getByText("Sponsored")).toBeTruthy();
    expect(screen.getByText("Sponsored · shown because it matches your skill gap: statistics")).toBeTruthy();
    expect(screen.getByText("Doesn't change your recommendations. Free and government courses come first.")).toBeTruthy();
    expect(container.firstElementChild!.className).toContain("print:hidden");
    expect(screen.queryByText(/Paid placement\./)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Why am I seeing this?" }));
    expect(screen.getByText("Paid placement. Matches a skill gap in your pathway. Does not change your ranking or pathway.")).toBeTruthy();
  });
});
