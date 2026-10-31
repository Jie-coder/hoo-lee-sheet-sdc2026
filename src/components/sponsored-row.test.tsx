import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n-messages";
import { SPONSORED_COURSES } from "@/lib/sponsored";
import { SponsoredRow } from "./pathway-view";

const t = ((key: never, vars?: Record<string, string>) => translate("en", key, vars)) as never;
const stats = SPONSORED_COURSES.find((c) => c.id === "spn-001")!;

describe("SponsoredRow", () => {
  it("renders the orange card from data, the cross-stop free line and the why popover, and is print-hidden", () => {
    const onJump = vi.fn();
    const { container } = render(
      <SponsoredRow t={t} pick={{ stopIndex: 6, skillId: "s", course: stats }} skillLabel="statistics" refStop={4} sameStop={false} government={false} onJump={onJump} />,
    );
    expect(screen.getByText("Sponsored")).toBeTruthy();
    expect(screen.getByText("1 of max 1 · this stop")).toBeTruthy();
    expect(screen.getByText("Statistics in Practice")).toBeTruthy();
    expect(screen.getByTestId("sponsored-badges").textContent).toContain("Certificate included");
    expect(screen.getByText("Tamaskri Learning")).toBeTruthy();
    expect(screen.getByText("RM 149")).toBeTruthy();
    expect(screen.getByText("RM 229").tagName).toBe("S");
    expect(container.textContent).not.toMatch(/PLACEHOLDER|Example|Doesn't change your recommendations\. Free/);
    expect(container.firstElementChild!.className).toContain("print:hidden");
    expect(screen.getByTestId("sponsored-free-line").textContent).toBe("✓Free alternative · also covers statistics:Stop 04 →");
    fireEvent.click(screen.getByRole("link", { name: "Stop 04 →" }));
    expect(onJump).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Paid placement\./)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Why am I seeing this\?/ }));
    expect(
      screen.getByText(
        "Paid placement. Matches a skill in this stop. Doesn't change your recommendations, ranking or pathway — free and government courses always come first.",
      ),
    ).toBeTruthy();
  });

  it("shows the free-first line when this stop's own course is free", () => {
    render(<SponsoredRow t={t} pick={{ stopIndex: 1, skillId: "s", course: SPONSORED_COURSES[1] }} skillLabel="x" refStop={2} sameStop government={false} onJump={() => {}} />);
    expect(screen.getByTestId("sponsored-free-line").textContent).toBe("✓Free / government firstThis stop's course is free");
  });

  it("claims nothing about free courses when no free/government course covers the skill", () => {
    const { container } = render(
      <SponsoredRow t={t} pick={{ stopIndex: 5, skillId: "s", course: stats }} skillLabel="statistics" refStop={null} sameStop={false} government={false} onJump={() => {}} />,
    );
    expect(screen.queryByTestId("sponsored-free-line")).toBeNull();
    expect(container.textContent).not.toMatch(/free/i);
  });
});
