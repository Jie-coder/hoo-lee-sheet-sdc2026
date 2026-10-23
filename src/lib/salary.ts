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

export function formatMonthlyRange(min: number, max: number, perMonth = "/ month"): string {
  return `RM ${min.toLocaleString("en-MY")} – ${max.toLocaleString("en-MY")} ${perMonth}`;
}

const TABLE = salaryByRole as Record<string, RoleSalary>;

export function salaryForRole(occupationId: string): RoleSalary | undefined {
  return TABLE[occupationId];
}

export function formatMonthlyRm(value: number, perMonth = "/ month"): string {
  return `RM ${value.toLocaleString("en-MY")} ${perMonth}`;
}
