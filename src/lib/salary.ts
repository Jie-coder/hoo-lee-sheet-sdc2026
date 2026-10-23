// Average monthly wage for a role's MASCO 1-digit major group (DOSM Salaries &
// Wages Survey 2025, Exhibit 4). Built from data/salary_by_role.csv; keyed by occupation id.
import salaryByRole from "@/data/salary-by-role.json";

export type RoleSalary = {
  avgMonthlyRm: number;
  mascoMajor: string;
  mascoMajorName: string;
  year: number;
  sourceUrl: string;
  /** "jobstreet" = real published range; "dosm_major_group" = only the DOSM major-group mean is known. */
  sourceType: "jobstreet" | "dosm_major_group";
  minMonthlyRm?: number;
  maxMonthlyRm?: number;
  rangeSourceName?: string;
  rangeSourceRole?: string;
  rangeSourceUrl?: string;
  rangeYear?: number;
};

export function hasRealRange(s: RoleSalary): s is RoleSalary & { minMonthlyRm: number; maxMonthlyRm: number; rangeSourceName: string; rangeSourceUrl: string; rangeYear: number } {
  return s.sourceType !== "dosm_major_group" && typeof s.minMonthlyRm === "number" && typeof s.maxMonthlyRm === "number";
}

const NBSP = "\u00a0";

/** "RM 7,100 – 8,500" with non-breaking spaces so the range never splits. The unit is rendered separately. */
export function formatMonthlyRange(min: number, max: number): string {
  return `RM${NBSP}${min.toLocaleString("en-MY")}${NBSP}–${NBSP}${max.toLocaleString("en-MY")}`;
}

const TABLE = salaryByRole as Record<string, RoleSalary>;

export function salaryForRole(occupationId: string): RoleSalary | undefined {
  return TABLE[occupationId];
}

/** "RM 6,747" with a non-breaking space. The unit is rendered separately. */
export function formatMonthlyRm(value: number): string {
  return `RM\u00a0${value.toLocaleString("en-MY")}`;
}
