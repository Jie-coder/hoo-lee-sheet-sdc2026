export const FUNDED_COST_TYPES = [
  "free",
  "subsidised",
  "hrdcorp_claimable",
] as const;

type FundedCostType = (typeof FUNDED_COST_TYPES)[number];

function isFundedCostType(costType: string): costType is FundedCostType {
  return (FUNDED_COST_TYPES as readonly string[]).includes(costType);
}

export function gapCoverage(
  gapSkillIds: string[],
  steps: { closesSkillIds: string[]; costType: string }[],
): { closed: string[]; open: string[]; pct: number } {
  const fundedClosed = new Set<string>();
  for (const step of steps) {
    if (!isFundedCostType(step.costType)) continue;
    for (const skillId of step.closesSkillIds) fundedClosed.add(skillId);
  }

  const closed: string[] = [];
  const open: string[] = [];
  for (const skillId of gapSkillIds) {
    if (fundedClosed.has(skillId)) closed.push(skillId);
    else open.push(skillId);
  }

  const total = gapSkillIds.length;
  const pct = total === 0 ? 100 : (closed.length / total) * 100;

  return { closed, open, pct };
}

export function cohensKappa(
  a: string[],
  b: string[],
): { n: number; agreement: number; kappa: number } {
  if (a.length !== b.length) {
    throw new Error("cohensKappa requires arrays of equal length");
  }

  const n = a.length;
  if (n === 0) {
    throw new Error("cohensKappa requires at least one observation");
  }

  const countsA = new Map<string, number>();
  const countsB = new Map<string, number>();
  let matches = 0;

  for (let i = 0; i < n; i++) {
    const va = a[i];
    const vb = b[i];
    countsA.set(va, (countsA.get(va) ?? 0) + 1);
    countsB.set(vb, (countsB.get(vb) ?? 0) + 1);
    if (va === vb) matches++;
  }

  const agreement = matches / n;

  let pe = 0;
  const categories = new Set<string>([...countsA.keys(), ...countsB.keys()]);
  for (const category of categories) {
    pe +=
      ((countsA.get(category) ?? 0) / n) * ((countsB.get(category) ?? 0) / n);
  }

  const kappa = pe === 1 ? 1 : (agreement - pe) / (1 - pe);

  return { n, agreement, kappa };
}

export function isDatedSource(s: {
  url?: string | null;
  date?: string | null;
}): boolean {
  const url = s.url?.trim();
  if (!url) return false;

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return false;
  }
  if (protocol !== "http:" && protocol !== "https:") return false;

  return /^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "");
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededSample<T>(items: T[], n: number, seed: number): T[] {
  const copy = [...items];
  const rand = mulberry32(seed);

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  const take = Math.max(0, Math.min(n, copy.length));
  return copy.slice(0, take);
}

export function passFail(value: number, target: number): "PASS" | "FAIL" {
  return value >= target ? "PASS" : "FAIL";
}
