// Computes the KPI report for the Laluan demo. Run with:
//
//   npm run kpi
//
// The role-ranking and pathway pipeline below mirrors src/lib/landing-preview.ts
// exactly: same persona chips, same analyzeProfile inputs, same pathway builder.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeProfile } from "@/lib/analyze";
import { CATALOGUE } from "@/lib/catalogue";
import {
  cohensKappa,
  gapCoverage,
  isDatedSource,
  seededSample,
  FUNDED_COST_TYPES,
} from "@/lib/kpi";
import { buildPathwayPlan } from "@/lib/pathway";
import { resolveProfileSkills } from "@/lib/profile-skills";
import { skillSdg } from "@/lib/skill-sdg";
import { PERSONAS } from "@/mocks/personas";
import type { CostType, LanguageCode, RoleResult } from "@/types/contracts";
import { formatCsv, parseCsv } from "./lib/csv";

const KPI_DIR = "kpi";
const KPI_MD_PATH = join(KPI_DIR, "kpi-report.md");
const KPI_JSON_PATH = join(KPI_DIR, "kpi-report.json");
const HANDCHECK_PATH = join(KPI_DIR, "sdg-handcheck-50.csv");
const HANDCHECK_HEADER = [
  "pair_id",
  "occupation_id",
  "role_title",
  "sdg_target",
  "tier",
  "rater_a",
  "rater_b",
] as const;
const HANDCHECK_SIZE = 50;
const HANDCHECK_SEED = 2026;
const HOURS_PER_WEEK = 6;

type Status = "PASS" | "FAIL" | "PLACEHOLDER";

type KpiRow = {
  kpi: string;
  value: string;
  target: string;
  status: Status;
};

type PlanStep = ReturnType<typeof buildPathwayPlan>["steps"][number];

type TopRolePlan = {
  rank: number;
  role: RoleResult;
  steps: { step: PlanStep; costType: CostType }[];
  coverage: ReturnType<typeof gapCoverage>;
};

type PersonaPlans = {
  personaId: string;
  personaName: string;
  roles: TopRolePlan[];
};

function gitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function costTypeForStep(step: TopRolePlan["steps"][number]["step"]): CostType {
  const item =
    step.kind === "course"
      ? CATALOGUE.courses.find((course) => course.id === step.itemId)
      : CATALOGUE.programmes.find((programme) => programme.id === step.itemId);
  return item?.costType ?? "paid";
}

function planForRole(role: RoleResult, studyLanguages: readonly LanguageCode[]): TopRolePlan["steps"] {
  return buildPathwayPlan({
    role,
    courses: CATALOGUE.courses,
    programmes: CATALOGUE.programmes,
    studyLanguages,
    hoursPerWeek: HOURS_PER_WEEK,
    skillLinks: [],
    skillGroups: CATALOGUE.skillGroups,
    groupLabels: CATALOGUE.groupLabels,
  }).steps.map((step) => ({ step, costType: costTypeForStep(step) }));
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 100 : (numerator / denominator) * 100;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function mdCell(value: string | number): string {
  return String(value).replace(/\|/g, "\\|");
}

function buildPersonaPlans(): PersonaPlans[] {
  return Object.values(PERSONAS).map((persona) => {
    const chips = persona.parsed.skills.map((label) => ({ label, selfReported: false }));
    const { skills } = resolveProfileSkills(CATALOGUE, persona.id, chips);
    const result = analyzeProfile(CATALOGUE, {
      skills,
      currentOccupationId: persona.currentOccupationId,
      impactInterest: "none",
      signalDate: "today",
      adoption: 1,
    });
    const top = [...result.roles]
      .sort((a, b) => b.byScenario.co - a.byScenario.co)
      .slice(0, 3);

    const roles = top.map((role, index): TopRolePlan => {
      const steps = planForRole(role, persona.courseLanguages);
      const coverage = gapCoverage(
        role.gap.map((gap) => gap.skillId),
        steps.map(({ step, costType }) => ({
          closesSkillIds: step.closesSkillIds,
          costType,
        })),
      );
      return { rank: index + 1, role, steps, coverage };
    });

    return { personaId: persona.id, personaName: persona.name, roles };
  });
}

function kpi1(plans: PersonaPlans[]) {
  const rank1 = plans.map((persona) => ({
    personaId: persona.personaId,
    personaName: persona.personaName,
    role: persona.roles[0],
  }));
  const values = rank1.map((item) => item.role.coverage.pct);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const pass = values.every((value) => value >= 80) && mean >= 90;

  const sensitivity = plans.flatMap((persona) =>
    persona.roles.map((role) => ({
      personaId: persona.personaId,
      personaName: persona.personaName,
      rank: role.rank,
      occupationId: role.role.occupationId,
      title: role.role.title,
      co: role.role.byScenario.co,
      gap: role.role.gap.length,
      closed: role.coverage.closed.length,
      coveragePct: role.coverage.pct,
    })),
  );

  return {
    status: (pass ? "PASS" : "FAIL") as Status,
    value: `mean ${formatPct(mean)} (min ${formatPct(min)})`,
    target: "each ≥80%, mean ≥90%",
    mean,
    min,
    rank1: rank1.map((item) => ({
      personaId: item.personaId,
      personaName: item.personaName,
      occupationId: item.role.role.occupationId,
      title: item.role.role.title,
      coveragePct: item.role.coverage.pct,
      closed: item.role.coverage.closed,
      open: item.role.coverage.open,
      openDetail: item.role.coverage.open.map((skillId) => {
        const anyCourse = CATALOGUE.courses.filter((course) => course.skillIds.includes(skillId));
        const funded = anyCourse.filter((course) => (FUNDED_COST_TYPES as readonly string[]).includes(course.costType));
        const reason =
          anyCourse.length === 0
            ? "no catalogue course teaches it (pathway offers related-group courses only)"
            : funded.length === 0
              ? `only paid courses teach it (${anyCourse.map((course) => course.id).join(", ")})`
              : "funded course exists but was not picked into the plan (cap/language)";
        return { skillId, label: CATALOGUE.skills[skillId] ?? skillId, reason };
      }),
    })),
    sensitivity,
  };
}

function kpi2(plans: PersonaPlans[]) {
  type Check = {
    personaId: string;
    rank: number;
    occupationId: string;
    kind: string;
    label: string;
    url: string;
    date: string;
    valid: boolean;
  };
  const checks: Check[] = [];

  for (const persona of plans) {
    for (const top of persona.roles) {
      for (const source of top.role.sources) {
        checks.push({
          personaId: persona.personaId,
          rank: top.rank,
          occupationId: top.role.occupationId,
          kind: "role source",
          label: source.dataset,
          url: source.url,
          date: source.asOf,
          valid: isDatedSource({ url: source.url, date: source.asOf }),
        });
      }
      for (const link of top.role.sdg) {
        checks.push({
          personaId: persona.personaId,
          rank: top.rank,
          occupationId: top.role.occupationId,
          kind: "role SDG",
          label: link.target,
          url: link.source.url,
          date: link.source.asOf,
          valid: isDatedSource({ url: link.source.url, date: link.source.asOf }),
        });
      }
      for (const { step } of top.steps) {
        const item =
          step.kind === "course"
            ? CATALOGUE.courses.find((course) => course.id === step.itemId)
            : CATALOGUE.programmes.find((programme) => programme.id === step.itemId);
        const label =
          step.kind === "course"
            ? ((item as { title?: string } | undefined)?.title ?? step.itemId)
            : ((item as { name?: string } | undefined)?.name ?? step.itemId);
        const url = item?.url ?? "";
        const date = item?.lastChecked ?? "";
        checks.push({
          personaId: persona.personaId,
          rank: top.rank,
          occupationId: top.role.occupationId,
          kind: `pathway ${step.kind}`,
          label,
          url,
          date,
          valid: isDatedSource({ url, date }),
        });
      }
    }
  }

  const dated = checks.filter((check) => check.valid).length;
  const failures = checks.filter((check) => !check.valid);
  const value = pct(dated, checks.length);
  const pass = failures.length === 0;

  return {
    status: (pass ? "PASS" : "FAIL") as Status,
    value: `${dated}/${checks.length} (${formatPct(value)})`,
    target: "100%",
    total: checks.length,
    dated,
    pct: value,
    failures: failures.map((failure) => ({
      personaId: failure.personaId,
      rank: failure.rank,
      occupationId: failure.occupationId,
      kind: failure.kind,
      label: failure.label,
      url: failure.url,
      date: failure.date,
    })),
  };
}

function kpi3() {
  const occupations = CATALOGUE.occupations;
  const taggedOccupations = occupations.filter((occupation) => occupation.sdg.length > 0);
  const untaggedOccupations = occupations
    .filter((occupation) => occupation.sdg.length === 0)
    .map((occupation) => ({ id: occupation.id, title: occupation.title }));

  const skillIds = [...new Set(occupations.flatMap((occupation) => occupation.essentialSkillIds))].sort();
  const taggedSkills = skillIds.filter((skillId) => skillSdg(skillId, CATALOGUE) !== null);
  const untaggedSkills = skillIds
    .filter((skillId) => skillSdg(skillId, CATALOGUE) === null)
    .map((skillId) => ({
      id: skillId,
      label: CATALOGUE.skills[skillId] ?? skillId,
      reason: CATALOGUE.skillGroups[skillId] ? "group has no SDG row" : "no ESCO group mapped",
    }));
  // Skills the app actually shows an SDG for: gap skills on role cards / pathway (skillSdg in role-card.tsx, pathway-view.tsx).
  const noGroup = untaggedSkills.filter((item) => item.reason === "no ESCO group mapped").length;

  const occupationPct = pct(taggedOccupations.length, occupations.length);
  const skillPct = pct(taggedSkills.length, skillIds.length);
  const pass = untaggedOccupations.length === 0 && untaggedSkills.length === 0;

  return {
    status: (pass ? "PASS" : "FAIL") as Status,
    value: `occupations ${formatPct(occupationPct)} (${taggedOccupations.length}/${occupations.length}); skills ${formatPct(skillPct)} (${taggedSkills.length}/${skillIds.length})`,
    target: "100% occupations, 100% skills",
    occupations: {
      tagged: taggedOccupations.length,
      total: occupations.length,
      pct: occupationPct,
      untagged: untaggedOccupations,
    },
    skills: {
      tagged: taggedSkills.length,
      total: skillIds.length,
      pct: skillPct,
      untagged: untaggedSkills,
      noGroup,
      groupWithoutSdg: untaggedSkills.length - noGroup,
    },
  };
}

type SdgPair = {
  pairId: string;
  occupationId: string;
  roleTitle: string;
  sdgTarget: string;
  tier: string;
};

function sdgPairs(): SdgPair[] {
  return CATALOGUE.occupations.flatMap((occupation) =>
    occupation.sdg.map((sdg, index) => ({
      pairId: `${occupation.id}-${index + 1}`,
      occupationId: occupation.id,
      roleTitle: occupation.title,
      sdgTarget: sdg.target,
      tier: sdg.tier,
    })),
  );
}

function writeHandcheck(sample: SdgPair[]): void {
  mkdirSync(KPI_DIR, { recursive: true });
  const rows = sample.map((pair) => [
    pair.pairId,
    pair.occupationId,
    pair.roleTitle,
    pair.sdgTarget,
    pair.tier,
    "",
    "",
  ]);
  writeFileSync(HANDCHECK_PATH, formatCsv({ header: [...HANDCHECK_HEADER], rows }));
}

function kpi5(): {
  status: Status;
  value: string;
  target: string;
  sampleSize: number;
  csvPath: string;
  written: boolean;
  agreement?: number;
  directAgreement?: number;
  kappa?: number;
  rated?: number;
} {
  const sample = seededSample(sdgPairs(), HANDCHECK_SIZE, HANDCHECK_SEED);
  const target = "overall ≥80%, direct ≥90%, κ≥0.6";
  const exists = existsSync(HANDCHECK_PATH);

  if (!exists) {
    writeHandcheck(sample);
    return {
      status: "PLACEHOLDER",
      value: `hand-check not started (0/${sample.length} rated; wrote ${HANDCHECK_PATH})`,
      target,
      sampleSize: sample.length,
      csvPath: HANDCHECK_PATH,
      written: true,
    };
  }

  const parsed = parseCsv(readFileSync(HANDCHECK_PATH, "utf8"));
  const index = new Map(parsed.header.map((name, i) => [name, i]));
  const required = ["pair_id", "occupation_id", "role_title", "sdg_target", "tier", "rater_a", "rater_b"];
  const missing = required.filter((name) => !index.has(name));
  if (missing.length > 0) {
    return {
      status: "PLACEHOLDER",
      value: `cannot read hand-check CSV (missing columns: ${missing.join(", ")})`,
      target,
      sampleSize: sample.length,
      csvPath: HANDCHECK_PATH,
      written: false,
    };
  }

  const rows = parsed.rows.filter((row) => row.some((field) => field.trim() !== ""));
  const get = (row: string[], name: string) => row[index.get(name) as number] ?? "";
  const rated = rows.filter((row) => get(row, "rater_a").trim() !== "" && get(row, "rater_b").trim() !== "");
  const complete = rows.length === sample.length && rated.length === sample.length;

  if (!complete) {
    return {
      status: "PLACEHOLDER",
      value: `hand-check ${rated.length}/${sample.length} rated (rows ${rows.length}/${sample.length})`,
      target,
      sampleSize: sample.length,
      csvPath: HANDCHECK_PATH,
      written: false,
      rated: rated.length,
    };
  }

  const raterA = rated.map((row) => get(row, "rater_a").trim());
  const raterB = rated.map((row) => get(row, "rater_b").trim());
  const { agreement, kappa } = cohensKappa(raterA, raterB);
  const direct = rated.filter((row) => get(row, "tier").trim() === "direct");
  const directMatches = direct.filter(
    (row) => get(row, "rater_a").trim() === get(row, "rater_b").trim(),
  ).length;
  const directAgreement = direct.length === 0 ? 1 : directMatches / direct.length;

  const overallPct = agreement * 100;
  const directPct = directAgreement * 100;
  const pass = overallPct >= 80 && directPct >= 90 && kappa >= 0.6;

  return {
    status: (pass ? "PASS" : "FAIL") as Status,
    value: `overall ${formatPct(overallPct)} (κ ${kappa.toFixed(2)}); direct ${formatPct(directPct)} (${directMatches}/${direct.length})`,
    target,
    sampleSize: sample.length,
    csvPath: HANDCHECK_PATH,
    written: false,
    agreement: overallPct,
    directAgreement: directPct,
    kappa,
    rated: rated.length,
  };
}

function markdown(
  rows: KpiRow[],
  details: { kpi1: ReturnType<typeof kpi1>; kpi2: ReturnType<typeof kpi2>; kpi3: ReturnType<typeof kpi3>; kpi5: ReturnType<typeof kpi5> },
  snapshot: { asOf: string; gitSha: string },
  warning: string,
): string {
  const lines: string[] = [
    "# Laluan KPI report",
    "",
    `- Snapshot asOf: ${snapshot.asOf}`,
    `- Git SHA: \`${snapshot.gitSha}\``,
    "",
    `> **Warning:** ${warning}`,
    "",
    "| KPI | Value | Target | Status |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) => `| ${mdCell(row.kpi)} | ${mdCell(row.value)} | ${mdCell(row.target)} | ${row.status} |`,
    ),
    "",
    "## KPI1 sensitivity (rank 1–3)",
    "",
    "| Persona | Rank | Role | Co score | Gap skills | Closed | Coverage |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...details.kpi1.sensitivity.map(
      (item) =>
        `| ${mdCell(item.personaName)} | ${item.rank} | ${mdCell(item.title)} | ${item.co.toFixed(4)} | ${item.gap} | ${item.closed} | ${formatPct(item.coveragePct)} |`,
    ),
    "",
    "### KPI1 rank-1 detail",
    "",
    ...details.kpi1.rank1.map(
      (item) =>
        `- ${item.personaName} → ${item.title} (${item.occupationId}): ${formatPct(item.coveragePct)} closed (${item.closed.length} closed, ${item.open.length} open)` +
        item.openDetail.map((open) => `\n  - open: ${open.label} — ${open.reason}`).join(""),
    ),
    "",
    "## KPI2 dated-source failures",
    "",
    details.kpi2.failures.length === 0
      ? "None."
      : details.kpi2.failures
          .map(
            (failure) =>
              `- ${failure.personaId} rank ${failure.rank} · ${failure.kind} · ${failure.label} — url \`${failure.url}\`, date \`${failure.date}\``,
          )
          .join("\n"),
    "",
    "## KPI3 SDG coverage",
    "",
    `- Occupations: ${details.kpi3.occupations.tagged}/${details.kpi3.occupations.total} (${formatPct(details.kpi3.occupations.pct)})`,
    `- Skills: ${details.kpi3.skills.tagged}/${details.kpi3.skills.total} (${formatPct(details.kpi3.skills.pct)})`,
    `- Untagged skills by cause: ${details.kpi3.skills.noGroup} have no ESCO group in data/skill_groups.csv; ${details.kpi3.skills.groupWithoutSdg} have a group with no row in data/skill_group_sdg.csv`,
    "",
    "### Untagged occupations",
    "",
    details.kpi3.occupations.untagged.length === 0
      ? "None."
      : details.kpi3.occupations.untagged.map((item) => `- ${item.id} — ${item.title}`).join("\n"),
    "",
    "### Untagged skills",
    "",
    details.kpi3.skills.untagged.length === 0
      ? "None."
      : details.kpi3.skills.untagged.map((item) => `- ${item.id} — ${item.label} (${item.reason})`).join("\n"),
    "",
    "## KPI5 SDG hand-check",
    "",
    `- CSV: \`${details.kpi5.csvPath}\``,
    `- Sample size: ${details.kpi5.sampleSize}`,
    `- Status: ${details.kpi5.status} — ${details.kpi5.value}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const plans = buildPersonaPlans();
  const k1 = kpi1(plans);
  const k2 = kpi2(plans);
  const k3 = kpi3();
  const k5 = kpi5();

  const k4: KpiRow = {
    kpi: "KPI4 Minutes to finished pathway",
    value: "Not measured (placeholder)",
    target: "<3 minutes",
    status: "PLACEHOLDER",
  };

  const rows: KpiRow[] = [
    { kpi: "KPI1 Role #1 pathway gap coverage", value: k1.value, target: k1.target, status: k1.status },
    { kpi: "KPI2 Dated sources", value: k2.value, target: k2.target, status: k2.status },
    { kpi: "KPI3 SDG coverage", value: k3.value, target: k3.target, status: k3.status },
    k4,
    { kpi: "KPI5 SDG hand-check (50 pairs)", value: k5.value, target: k5.target, status: k5.status },
  ];

  const snapshot = { asOf: CATALOGUE.signalsAsOf, gitSha: gitSha() };
  const warning =
    "KPI1 depends on arXiv trend momentum and must be re-run after the persona re-run on refreshed trend data.";

  mkdirSync(KPI_DIR, { recursive: true });
  writeFileSync(KPI_MD_PATH, markdown(rows, { kpi1: k1, kpi2: k2, kpi3: k3, kpi5: k5 }, snapshot, warning));
  writeFileSync(
    KPI_JSON_PATH,
    `${JSON.stringify(
      {
        snapshot,
        warning,
        rows,
        details: { kpi1: k1, kpi2: k2, kpi3: k3, kpi4: { note: k4.value }, kpi5: k5 },
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Snapshot asOf: ${snapshot.asOf} · git ${snapshot.gitSha}`);
  console.table(rows);
  console.log(`Warning: ${warning}`);
  console.log(`Wrote ${KPI_MD_PATH} and ${KPI_JSON_PATH}`);
}

main();
