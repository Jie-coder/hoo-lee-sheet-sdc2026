// Converts between the decimal-years value stored on profile roles (used by
// scoring) and the Years + Months inputs shown on the profile page.

export const MAX_YEARS = 40;
export const MAX_MONTHS = 11;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Split decimal years (e.g. 2.5) into whole years and months (2, 6). */
export function decimalToYearsMonths(decimal: number): { years: number; months: number } {
  if (!Number.isFinite(decimal) || decimal <= 0) return { years: 0, months: 0 };
  let years = Math.floor(decimal);
  let months = Math.round((decimal - years) * 12);
  if (months === 12) {
    years += 1;
    months = 0;
  }
  if (years > MAX_YEARS) return { years: MAX_YEARS, months: 0 };
  return { years, months };
}

/** Combine years + months into decimal years, rounded to 2 dp. */
export function yearsMonthsToDecimal(years: number, months: number): number {
  const y = clampInt(years, 0, MAX_YEARS);
  const m = clampInt(months, 0, MAX_MONTHS);
  return Math.round((y + m / 12) * 100) / 100;
}
