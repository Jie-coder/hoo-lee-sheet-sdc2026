import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeSummary, newEntryIds, RankList } from "./trend-override-panel";
import { readFileSync } from "node:fs";
import { translate } from "@/lib/i18n-messages";

const before = [
  { id: "a", label: "Software developer", value: "0.9" },
  { id: "b", label: "Web developer", value: "0.8" },
];
const after = [
  { id: "a", label: "Software developer", value: "0.9" },
  { id: "c", label: "Data scientist", value: "0.85" },
];

describe("change-the-data NEW highlight", () => {
  it("finds roles that enter the after-ranking", () => {
    expect([...newEntryIds(before, after)]).toEqual(["c"]);
    expect(newEntryIds(before, before).size).toBe(0);
  });

  it("marks only the new row with a Sulfur background and NEW badge", () => {
    render(<RankList title="After" items={after} testId="after" newIds={newEntryIds(before, after)} />);
    const rows = screen.getAllByTestId("override-row-new");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Data scientist");
    expect(rows[0]).toHaveClass("bg-sulfur");
    expect(within(rows[0]).getByText("NEW")).toBeInTheDocument();
  });

  it("translates the badge", () => {
    expect(translate("en", "override.new")).toBe("NEW");
    expect(translate("ms", "override.new")).toBe("BARU");
  });

  it("never highlights the radar (rising) list; Sulfur only for persona new entries", () => {
    const src = readFileSync("src/components/trend-override-panel.tsx", "utf8");
    const rising = src.split("\n").find((line) => line.includes('testId="override-rising-after"'));
    expect(rising).toBeDefined();
    expect(rising).not.toContain("newIds");
    expect(src.match(/bg-sulfur/g)).toHaveLength(1);
  });

  it("renders the rising-style list without newIds with no override-row-new", () => {
    render(<RankList title="After" items={after} testId="rising-after" />);
    expect(screen.queryByTestId("override-row-new")).toBeNull();
  });
});

describe("change-the-data summary", () => {
  it("emphasises the first item and puts the rest on a smaller grey line", () => {
    render(<ChangeSummary label="What changed" changes={["Data scientist new at #3", "Web developer out", "A #2 → #4"]} empty="No change" />);
    const first = screen.getByTestId("override-changes-first");
    expect(first).toHaveTextContent("What changed: Data scientist new at #3");
    expect(first).toHaveClass("font-bold", "text-ink");
    const rest = screen.getByTestId("override-changes-rest");
    expect(rest).toHaveTextContent("Web developer out; A #2 → #4");
    expect(rest).toHaveClass("text-grey", "text-[12px]");
  });

  it("omits the second line when only one item changed, and shows the empty text", () => {
    const { unmount } = render(<ChangeSummary label="Apa berubah" changes={["X baharu"]} empty="Tiada" />);
    expect(screen.queryByTestId("override-changes-rest")).toBeNull();
    unmount();
    render(<ChangeSummary label="x" changes={[]} empty="Tiada perubahan" />);
    expect(screen.getByTestId("override-changes")).toHaveTextContent("Tiada perubahan");
  });
});
