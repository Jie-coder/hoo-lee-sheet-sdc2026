import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { newEntryIds, RankList } from "./trend-override-panel";
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
});
