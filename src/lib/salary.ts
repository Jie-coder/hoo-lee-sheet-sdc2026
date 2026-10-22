// Average monthly wage for a role's MASCO 1-digit major group (DOSM Salaries &
// Wages Survey 2025, Exhibit 4). Built from data/salary_by_role.csv; keyed by occupation id.
import salaryByRole from "@/data/salary-by-role.json";

export type RoleSalary = {
  avgMonthlyRm: number;
  mascoMajor: string;
  mascoMajorName: string;
  year: number;
  sourceUrl: string;
};

const TABLE = salaryByRole as Record<string, RoleSalary>;

export function salaryForRole(occupationId: string): RoleSalary | undefined {
  return TABLE[occupationId];
}

export function formatMonthlyRm(value: number, perMonth = "/ month"): string {
  return `RM ${value.toLocaleString("en-MY")} ${perMonth}`;
}
