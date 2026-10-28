import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeSummary, movedBadge, newEntryIds, orderChanges, pickHighlight, RankList } from "./trend-override-panel";
import type { RankChange } from "@/lib/compare-snapshots";
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

const ch = (occupationId: string, b: number | null, a: number | null): RankChange => ({ occupationId, title: occupationId.toUpperCase(), before: b, after: a });
const ids = (...xs: string[]) => xs.map((id) => ({ id }));

describe("change-the-data biggest-mover highlight", () => {
  it("new entries take priority over movers", () => {
    const h = pickHighlight([ch("a", 1, 4), ch("c", 7, 2)], ids("a", "b"), ids("c", "a"));
    expect(h?.kind).toBe("new");
    expect(h?.kind === "new" && [...h.ids]).toEqual(["c"]);
  });

  it("picks the largest absolute move; ties go to the better before rank, then id", () => {
    const shown = ids("a", "b", "c", "d", "e");
    expect(pickHighlight([ch("e", 4, 3), ch("a", 1, 4), ch("d", 3, 2)], shown, shown)).toEqual({ kind: "moved", id: "a", before: 1, after: 4 });
    expect(pickHighlight([ch("c", 3, 1), ch("a", 1, 3)], shown, shown)).toMatchObject({ id: "a" });
    expect(pickHighlight([ch("b", 2, 3), ch("a", 2, 1)], shown, shown)).toMatchObject({ id: "a" });
  });

  it("falls back to the biggest mover among shown rows", () => {
    const h = pickHighlight([ch("z", 2, 9), ch("b", 3, 2)], ids("a", "z", "b", "c"), ids("a", "b", "c"));
    expect(h).toMatchObject({ kind: "moved", id: "b" });
  });

  it("returns no highlight when nothing changed", () => {
    expect(pickHighlight([], ids("a", "b"), ids("a", "b"))).toBeNull();
    render(<RankList title="After" items={after.slice(0, 1)} testId="x" highlight={null} />);
    expect(screen.queryByTestId("override-row-moved")).toBeNull();
    expect(screen.queryByTestId("override-row-new")).toBeNull();
    render(<ChangeSummary label="x" changes={orderChanges([], null).map((c) => c.title)} empty="No change" />);
    expect(screen.getByTestId("override-changes")).toHaveTextContent("No change");
  });

  it("formats badges for drops and rises", () => {
    expect(movedBadge(1, 4)).toBe("↓3 · #1 → #4");
    expect(movedBadge(4, 3)).toBe("↑1 · #4 → #3");
  });

  it("puts the highlighted role first in the summary order", () => {
    const changes = [ch("e", 4, 3), ch("a", 1, 4)];
    const h = pickHighlight(changes, ids("a", "e"), ids("e", "a"));
    expect(orderChanges(changes, h).map((c) => c.occupationId)).toEqual(["a", "e"]);
  });

  it("renders exactly one moved row with Sulfur and the badge", () => {
    render(<RankList title="After" items={before} testId="after" highlight={{ kind: "moved", id: "b", before: 1, after: 2 }} />);
    const rows = screen.getAllByTestId("override-row-moved");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Web developer");
    expect(rows[0]).toHaveClass("bg-sulfur", "text-ink");
    expect(within(rows[0]).getByText("↓1 · #1 → #2")).toHaveClass("bg-ink", "text-sulfur");
    expect(screen.queryByTestId("override-row-new")).toBeNull();
  });
});
