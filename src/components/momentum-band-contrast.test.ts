import fs from "node:fs";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

function readSource(relative: string): string {
  return fs.readFileSync(new URL(relative, import.meta.url), "utf8");
}

function token(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing --${name} hex token`);
  return match[1];
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, i) => alpha * channel + (1 - alpha) * background[i]) as Rgb;
}

const css = readSource("../app/globals.css");
const obsidian = hexToRgb(token(css, "color-obsidian"));
const sulfur = hexToRgb(token(css, "color-sulfur"));
const card = hexToRgb(token(css, "card"));

const track = composite(obsidian, card, 0.1);
const ring = composite(obsidian, track, 0.7);
const zeroLine = composite(obsidian, track, 0.7);
const oldRing = composite(obsidian, track, 0.4);

const ringVsTrack = contrast(ring, track);
const ringVsSulfur = contrast(ring, sulfur);
const zeroVsTrack = contrast(zeroLine, track);
const sulfurVsTrack = contrast(sulfur, track);
const oldRingVsTrack = contrast(oldRing, track);

console.log(`ring vs track: ${ringVsTrack.toFixed(2)}`);
console.log(`ring vs sulfur: ${ringVsSulfur.toFixed(2)}`);
console.log(`zero line vs track: ${zeroVsTrack.toFixed(2)}`);
console.log(`sulfur vs track: ${sulfurVsTrack.toFixed(2)}`);
console.log(`old ring (obsidian/40) vs track: ${oldRingVsTrack.toFixed(2)}`);

const source = readSource("./radar-view.tsx");

describe("momentum band contrast", () => {
  it("keeps the band ring and zero line at 3:1 or better", () => {
    expect(ringVsTrack).toBeGreaterThanOrEqual(3);
    expect(ringVsSulfur).toBeGreaterThanOrEqual(3);
    expect(zeroVsTrack).toBeGreaterThanOrEqual(3);
  });

  it("uses the stronger obsidian treatments in radar-view.tsx", () => {
    expect(source).toContain("ring-obsidian/70");
    expect(source).toContain("border-obsidian/70");
    expect(source).not.toContain("ring-obsidian/40");
    expect(source).not.toContain('{t("radar.unclear")} ?');
  });
});
