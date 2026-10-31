import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n-messages";
import { SPONSORED_COURSES } from "@/lib/sponsored";
import { SponsoredRow } from "./pathway-view";

describe("SponsoredRow", () => {
  it("renders the Sponsored label, reason and the 'Why am I seeing this?' disclosure, and is print-hidden", () => {
    const t = ((key: never, vars?: Record<string, string>) => translate("en", key, vars)) as never;
    const onJump = vi.fn();
    const { container } = render(
      <SponsoredRow t={t} pick={{ stopIndex: 3, skillId: "s", course: SPONSORED_COURSES[0] }} skillLabel="statistics" refStop={4} sameStop={false} government={false} onJump={onJump} />,
    );
    expect(screen.getByText("Sponsored")).toBeTruthy();
    expect(screen.getByText("Sponsored · shown because it matches your skill gap: statistics")).toBeTruthy();
    expect(screen.getByText("Doesn't change your recommendations. Free and government courses come first.")).toBeTruthy();
    expect(container.firstElementChild!.className).toContain("print:hidden");
    expect(screen.queryByText(/Paid placement\./)).toBeNull();
    expect(screen.getByTestId("sponsored-free-line").textContent).toBe("Free alternative · also covers statistics: Stop 04");
    expect(screen.queryByText(/Basic Statistics/)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Stop 04" }));
    expect(onJump).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Why am I seeing this?" }));
    expect(screen.getByText("Paid placement. Matches a skill gap in your pathway. Does not change your ranking or pathway.")).toBeTruthy();
  });

  it("shows a single free-first line when the free course is the same stop", () => {
    const t = ((key: never, vars?: Record<string, string>) => translate("en", key, vars)) as never;
    render(<SponsoredRow t={t} pick={{ stopIndex: 1, skillId: "s", course: SPONSORED_COURSES[1] }} skillLabel="x" refStop={2} sameStop government={false} onJump={() => {}} />);
    expect(screen.getByTestId("sponsored-free-line").textContent).toBe("Free / government first ✓ This stop's course is free");
  });
});
