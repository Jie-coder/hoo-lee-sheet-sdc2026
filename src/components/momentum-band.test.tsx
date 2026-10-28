import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MomentumBandStrip } from "./radar-view";
import { EN, MS } from "@/lib/i18n-messages";

function fillLeft(): string {
  const strip = screen.getByTestId("momentum-band");
  const fill = strip.firstElementChild as HTMLElement;
  return fill.style.left;
}

function fillWidth(): string {
  const strip = screen.getByTestId("momentum-band");
  const fill = strip.firstElementChild as HTMLElement;
  return fill.style.width;
}

describe("MomentumBandStrip", () => {
  it("renders the band strip", () => {
    render(<MomentumBandStrip band={{ momentum: 0.1, se: 0.05, low: 0.002, high: 0.198, crossesZero: false }} />);
    expect(screen.getByTestId("momentum-band")).toBeInTheDocument();
  });

  it("positions the Sulfur fill at the low and high of a band inside ±1", () => {
    render(<MomentumBandStrip band={{ momentum: 0.1, se: 0.05, low: 0.002, high: 0.198, crossesZero: false }} />);
    expect(parseFloat(fillLeft())).toBeCloseTo(50.1, 5);
    expect(parseFloat(fillWidth())).toBeCloseTo(9.8, 5);
  });

  it("clips a band wider than ±1 to the full 0%..100% strip", () => {
    render(<MomentumBandStrip band={{ momentum: 0, se: 2, low: -5, high: 5, crossesZero: true }} />);
    expect(parseFloat(fillLeft())).toBeCloseTo(0, 5);
    expect(parseFloat(fillWidth())).toBeCloseTo(100, 5);
  });
});

describe("radar.band i18n", () => {
  const bandKeys = Object.keys(EN).filter((key) => key.startsWith("radar.band"));
  const cjk = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

  it("has every radar.band key in both EN and MS", () => {
    expect(bandKeys.length).toBeGreaterThan(0);
    for (const key of bandKeys) {
      expect(EN[key as keyof typeof EN], key).toBeDefined();
      expect(MS[key as keyof typeof MS], key).toBeDefined();
    }
  });

  it("differs between MS and EN except radar.bandPlusMinus", () => {
    for (const key of bandKeys) {
      if (key === "radar.bandPlusMinus") continue;
      expect(MS[key as keyof typeof MS], key).not.toBe(EN[key as keyof typeof EN]);
    }
  });

  it("contains no CJK characters or English/Malay 'machine'/'mesin' words", () => {
    for (const key of bandKeys) {
      const value = MS[key as keyof typeof MS];
      expect(value, key).not.toMatch(cjk);
      expect(value.toLowerCase(), key).not.toContain("machine");
      expect(value.toLowerCase(), key).not.toContain("mesin");
    }
    for (const key of bandKeys) {
      const value = EN[key as keyof typeof EN];
      expect(value.toLowerCase(), key).not.toContain("machine");
      expect(value.toLowerCase(), key).not.toContain("mesin");
    }
  });
});
