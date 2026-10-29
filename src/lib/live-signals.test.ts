import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/catalogue";
import {
  TREND_SOURCE_NAME,
  applyMomentumOverrides,
  applySignals,
  bundledSnapshot,
  isTrendSnapshot,
  toSignalSnapshot,
  withCounts,
} from "@/lib/live-signals";
import { buildRadar } from "@/lib/radar";
import { SignalSnapshotSchema } from "@/types/contracts";

describe("live signal snapshots", () => {
  const trend = bundledSnapshot(CATALOGUE);

  it("the bundled snapshot reproduces the bundled catalogue momentum", () => {
    expect(trend.source).toBe(TREND_SOURCE_NAME);
    expect(isTrendSnapshot(trend)).toBe(true);
    const applied = applySignals(CATALOGUE, toSignalSnapshot(trend), trend.keywords);
    expect(Object.keys(applied.signals).sort()).toEqual(Object.keys(CATALOGUE.signals).sort());
    for (const [skillId, signal] of Object.entries(CATALOGUE.signals)) {
      expect(applied.signals[skillId].momentum).toBeCloseTo(signal.momentum, 9);
      expect(applied.signals[skillId].keywords.sort()).toEqual([...signal.keywords].sort());
    }
  });

  it("emits the shared SignalSnapshot contract shape", () => {
    expect(SignalSnapshotSchema.safeParse(toSignalSnapshot(trend)).success).toBe(true);
  });

  it("dates the catalogue by the snapshot", () => {
    const applied = applySignals(CATALOGUE, { ...toSignalSnapshot(trend), asOf: "2026-10-29" });
    expect(applied.signalsAsOf).toBe("2026-10-29");
    expect(applied.keywords.prior).toEqual(CATALOGUE.keywords.prior);
  });

  it("changed counts change momentum, scores and the radar", () => {
    const target = trend.keywords.find((keyword) => keyword.enough && keyword.skillIds.length > 0)!;
    const surged = { ...trend, keywords: trend.keywords.map((k) => (k === target ? withCounts(k, k.recent * 10 + 100, k.previous) : k)) };
    const before = applySignals(CATALOGUE, toSignalSnapshot(trend), trend.keywords);
    const after = applySignals(CATALOGUE, toSignalSnapshot(surged), surged.keywords);
    const skill = target.skillIds[0];
    expect(after.signals[skill].momentum).toBeGreaterThan(before.signals[skill].momentum);
    expect(buildRadar(after, "today")).not.toEqual(buildRadar(before, "today"));
  });

  it("momentum overrides set signals[skillId].momentum and never mutate the input", () => {
    const snapshot = toSignalSnapshot(trend);
    const copy = structuredClone(snapshot);
    const skillId = snapshot.signals[0].skillId;
    const applied = applySignals(CATALOGUE, applyMomentumOverrides(snapshot, [{ skillId, momentum: 3 }]), trend.keywords);
    expect(applied.signals[skillId].momentum).toBe(3);
    expect(snapshot).toEqual(copy);
  });

  it("withCounts recomputes momentum and enough", () => {
    const keyword = withCounts(trend.keywords[0], 5, 5);
    expect(keyword.momentum).toBeCloseTo(0, 9);
    expect(keyword.enough).toBe(false);
  });

  it("rejects malformed snapshots", () => {
    expect(isTrendSnapshot(null)).toBe(false);
    expect(isTrendSnapshot({ source: "arXiv API" })).toBe(false);
  });
});
