import { describe, expect, it } from "vitest";
import { freeCostMessages, summariseFreeCost } from "@/lib/free-cost";

const free = { costType: "free" };
const paid = { costType: "paid" };
const subsidised = { costType: "subsidised" };

describe("summariseFreeCost", () => {
  it("handles zero items", () => {
    expect(summariseFreeCost([])).toEqual({ total: 0, free: 0, unknown: 0, percent: 0 });
  });

  it("counts 5 of 7 free as 71%", () => {
    const items = [free, free, free, free, free, paid, subsidised];
    expect(summariseFreeCost(items)).toEqual({ total: 7, free: 5, unknown: 0, percent: 71 });
  });

  it("handles all free and none free", () => {
    expect(summariseFreeCost([free, free]).percent).toBe(100);
    expect(summariseFreeCost([paid, subsidised])).toMatchObject({ free: 0, percent: 0 });
  });

  it("counts missing, unrecognised and unresolved costs as unknown, not free", () => {
    const summary = summariseFreeCost([free, {}, { costType: null }, { costType: "gratis" }, null, undefined]);
    expect(summary).toEqual({ total: 6, free: 1, unknown: 5, percent: 17 });
  });
});

describe("freeCostMessages", () => {
  const keys = (items: Parameters<typeof summariseFreeCost>[0]) =>
    freeCostMessages(summariseFreeCost(items)).map((message) => message.key);

  it("picks a message per edge case", () => {
    expect(keys([])).toEqual(["pathway.costNoStops"]);
    expect(keys([free, free])).toEqual(["pathway.costAllFree"]);
    expect(keys([paid])).toEqual(["pathway.costNoneFree"]);
    expect(keys([free, paid])).toEqual(["pathway.costSomeFree"]);
    expect(keys([{}, null])).toEqual(["pathway.costAllUnknown"]);
  });

  it("appends the unknown count and never reports all free when some are unknown", () => {
    expect(keys([free, free, {}])).toEqual(["pathway.costSomeFree", "pathway.costUnknownCount"]);
    expect(keys([paid, {}])).toEqual(["pathway.costNoneFree", "pathway.costUnknownCount"]);
  });

  it("passes the counts as params", () => {
    const [message] = freeCostMessages(summariseFreeCost([free, free, free, free, free, paid, paid]));
    expect(message.params).toEqual({ free: "5", total: "7", percent: "71" });
  });
});
