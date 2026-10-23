import { describe, expect, it } from "vitest";
import { decimalToYearsMonths, yearsMonthsToDecimal } from "./years-months";

describe("years/months conversion", () => {
  it("handles zero", () => {
    expect(yearsMonthsToDecimal(0, 0)).toBe(0);
    expect(decimalToYearsMonths(0)).toEqual({ years: 0, months: 0 });
  });
  it("converts years + months to decimal", () => {
    expect(yearsMonthsToDecimal(2, 6)).toBe(2.5);
    expect(yearsMonthsToDecimal(0, 11)).toBe(0.92);
    expect(yearsMonthsToDecimal(1, 1)).toBe(1.08);
  });
  it("clamps and truncates invalid input", () => {
    expect(yearsMonthsToDecimal(-3, -1)).toBe(0);
    expect(yearsMonthsToDecimal(2, 15)).toBe(yearsMonthsToDecimal(2, 11));
    expect(yearsMonthsToDecimal(99, 0)).toBe(40);
    expect(yearsMonthsToDecimal(1.7, 3.9)).toBe(1.25);
    expect(yearsMonthsToDecimal(Number.NaN, 6)).toBe(0.5);
  });
  it("splits decimal back into years + months", () => {
    expect(decimalToYearsMonths(2.5)).toEqual({ years: 2, months: 6 });
    expect(decimalToYearsMonths(0.92)).toEqual({ years: 0, months: 11 });
    expect(decimalToYearsMonths(3.1)).toEqual({ years: 3, months: 1 });
  });
  it("rounds near-whole values up to the next year", () => {
    expect(decimalToYearsMonths(1.97)).toEqual({ years: 2, months: 0 });
  });
  it("handles negative, NaN and over-max", () => {
    expect(decimalToYearsMonths(-1)).toEqual({ years: 0, months: 0 });
    expect(decimalToYearsMonths(Number.NaN)).toEqual({ years: 0, months: 0 });
    expect(decimalToYearsMonths(55)).toEqual({ years: 40, months: 0 });
  });
  it("round-trips every years/months pair", () => {
    for (let y = 0; y <= 40; y++)
      for (let m = 0; m <= 11; m++) expect(decimalToYearsMonths(yearsMonthsToDecimal(y, m))).toEqual({ years: y, months: m });
  });
});
