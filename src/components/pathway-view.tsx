// Pathway (spec §6): the chosen role's skill gap as a week-by-week route — a
// Plasma boarding-pass hero, a vertical "line" of stop cards, and a sticky
// skill-gap card. Built only from the curated courses and programmes in data/*.csv.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Download, Trash2 } from "lucide-react";
import { IllustrationPanel, Perforation, SdgChip, SourceRow } from "@/components/caldera";
import { EASE_OUT } from "@/components/motion";
import { useFlow } from "@/context/flow-context";
import { formatDayMonthYear, missingValue } from "@/lib/display";
import { useT, type MessageKey } from "@/lib/i18n";
import { buildPathwayPlan } from "@/lib/pathway";
import { useRoles } from "@/lib/use-roles";
import { cn } from "@/lib/utils";
import type { Course, CostType, PlanStep, Programme } from "@/types/contracts";

const COST_LABEL_KEY: Record<CostType, MessageKey> = {
  free: "pathway.cost.free",
  subsidised: "pathway.cost.subsidised",
  hrdcorp_claimable: "pathway.cost.hrdcorpClaimable",
  paid: "pathway.cost.paid",
};

const VISIBLE_STOPS = 4;

export function PathwayView({
  courses,
  programmes,
  courseSkillGroups,
}: {
  courses: readonly Course[];
  programmes: readonly Programme[];
  /** ESCO group of each skill a course teaches, for related-course suggestions. */
  courseSkillGroups: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const { t, locale } = useT();
  const { hydrated, consent, profile, interviewAnswers, chosenRoleId, setChosenRoleId, resetFlow } = useFlow();
  const { state, retry } = useRoles(profile, interviewAnswers.impact_interest);
  const data = state.status === "ready" ? state.data : null;

  const roleId = searchParams.get("role") ?? chosenRoleId;
  const role = roleId && data ? (data.roles.find((item) => item.occupationId === roleId) ?? null) : null;
  const breakdown = role && data ? data.breakdown[role.occupationId] : null;
  const targetLabels = data?.targetLabels ?? {};
  const studyLanguages = profile?.courseLanguages ?? ["en" as const];
  const hoursPerWeek = interviewAnswers.hours_per_week ?? 6;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const studyLanguagesKey = studyLanguages.join(",");
  const plan = useMemo(() => {
    if (!role || !data) return null;
    return buildPathwayPlan({
      role,
      courses,
      programmes,
      studyLanguages,
      hoursPerWeek,
      skillLinks: [],
      skillGroups: { ...courseSkillGroups, ...(breakdown?.gapGroups ?? {}) },
      groupLabels: data.groupLabels,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- studyLanguagesKey is the stable form of studyLanguages
  }, [role, data, breakdown, courses, programmes, courseSkillGroups, studyLanguagesKey, hoursPerWeek]);

  useEffect(() => {
    if (!hydrated) return;
    if (!consent) {
      router.replace("/");
      return;
    }
    if (!profile) {
      router.replace("/profile");
      return;
    }
    if (!roleId) router.replace("/results");
  }, [hydrated, consent, profile, roleId, router]);

  useEffect(() => {
    if (roleId && roleId !== chosenRoleId) setChosenRoleId(roleId);
  }, [roleId, chosenRoleId, setChosenRoleId]);

  if (!profile) return null;

  if (state.status !== "ready" || !role || !plan) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 pt-10 pb-20 sm:px-6 md:px-8">
        {state.status === "loading" && (
          <p className="text-[14px] text-grey" aria-live="polite">
            {t("pathway.buildingPlan")}
          </p>
        )}
        {state.status === "error" && (
          <div className="rounded-[40px] bg-card p-7 text-[14px]" role="alert">
            <p className="font-bold">{t("pathway.loadError")}</p>
            <p className="mt-1 text-grey">{state.message}</p>
            <button type="button" onClick={retry} className="btn-secondary mt-4">
              {t("pathway.tryAgain")}
            </button>
          </div>
        )}
        {state.status === "ready" && (
          <div className="rounded-[40px] bg-card p-7 text-[14px]">
            <p className="font-bold">{t("pathway.roleNotInResults")}</p>
            <p className="mt-1 text-grey">{t("pathway.pickRankedRole")}</p>
            <button type="button" onClick={() => router.push("/results")} className="btn-secondary mt-4">
              <ArrowLeft className="size-4" strokeWidth={1.6} />
              {t("pathway.backToRoles")}
            </button>
          </div>
        )}
      </main>
    );
  }

  function resolveItem(step: PlanStep): Course | Programme | null {
    if (step.kind === "course") return courses.find((course) => course.id === step.itemId) ?? null;
    return programmes.find((programme) => programme.id === step.itemId) ?? null;
  }

  const totalWeeks = plan.steps.reduce((max, step) => Math.max(max, step.weekEnd), 0);
  const closedSkillIds = new Set(plan.steps.flatMap((step) => step.closesSkillIds));
  const freeCount = plan.steps.filter((step) => resolveItem(step)?.costType === "free").length;
  const mostlyFree = freeCount >= plan.steps.length / 2;
  const fromRole = data?.currentWork?.title ?? profile.roles[0]?.title ?? null;
  const firstUrl = plan.steps.map((step) => resolveItem(step)?.url).find((url) => url) ?? null;
  const catalogueDate = plan.steps
    .map((step) => resolveItem(step)?.lastChecked)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);

  const visibleSteps = showAll ? plan.steps : plan.steps.slice(0, VISIBLE_STOPS);

  function handleDelete() {
    resetFlow();
    router.push("/");
  }

  return (
    <div>
      <main className="print-hide mx-auto max-w-[1440px] px-4 pb-20 sm:px-6 md:px-8">
        {/* Top controls */}
        <div className="flex items-center justify-between gap-3 pt-6 md:pt-8">
          <button
            type="button"
            onClick={() => router.push("/results")}
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-grey hover:text-ink"
          >
            <ArrowLeft className="size-4" strokeWidth={1.6} />
            {t("pathway.backToRoutes")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink px-5 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            <Download className="size-4" strokeWidth={1.6} />
            {t("pathway.downloadPdf")}
          </button>
        </div>

        {/* Boarding-pass hero */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="relative mt-5 overflow-hidden rounded-[40px] bg-plasma px-7 py-9 text-limestone md:mt-6 md:px-14 md:py-12"
        >
          <span aria-hidden className="absolute top-[64%] -left-[18px] size-9 rounded-full bg-paper max-md:size-6 max-md:-left-3" />
          <span aria-hidden className="absolute top-[64%] -right-[18px] size-9 rounded-full bg-paper max-md:size-6 max-md:-right-3" />
          <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-end">
            <div>
              <p className="font-mono text-[12px] tracking-[0.06em] text-limestone/70 uppercase">
                {fromRole
                  ? t("pathway.boardingFrom", { from: fromRole, to: role.title })
                  : t("pathway.boardingTo", { to: role.title })}
              </p>
              <h1 className="mt-5 font-serif text-[clamp(44px,10vw,88px)] leading-[0.9] text-balance uppercase">
                {t("pathway.heroHeading", { weeks: String(totalWeeks), title: role.title })}
              </h1>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-7 [&>div]:min-w-0">
              <HeroStat label={t("pathway.pace")} value={t("pathway.hoursPerWeek", { hours: String(hoursPerWeek) })} />
              <HeroStat label={t("pathway.cost")} value={mostlyFree ? t("pathway.mostlyFree") : t("pathway.mixedCost")} />
              <HeroStat
                label={t("pathway.skillsClosed")}
                value={`${closedSkillIds.size} ${t("pathway.ofTotal", { count: String(role.gap.length) })}`}
              />
              <HeroStat label={t("pathway.stops")} value={String(plan.steps.length)} />
            </dl>
          </div>
        </motion.section>

        {/* The line + sticky side */}
        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_380px] md:items-start md:gap-12">
          {/* The line */}
          <section className="order-2 md:order-1">
            <h2 className="font-serif text-[clamp(40px,8vw,64px)] leading-[0.95] uppercase">{t("pathway.theLine")}</h2>
            <ol className="relative mt-8 pl-12">
              <span aria-hidden className="absolute top-8 bottom-8 left-[14px] w-1 rounded bg-ink" />
              {visibleSteps.map((step) => {
                const item = resolveItem(step);
                if (!item) return null;
                const index = plan.steps.indexOf(step);
                const expanded = expandedId === step.itemId;
                const title = "title" in item ? item.title : item.name;
                const providerName = "provider" in item ? item.provider : item.agency;
                const weeksLabel =
                  step.weekStart === step.weekEnd
                    ? t("pathway.week", { week: String(step.weekStart) })
                    : t("pathway.weeksRange", { start: String(step.weekStart), end: String(step.weekEnd) });
                const displayHours = step.merged?.hours ?? ("hours" in item ? item.hours : undefined);
                const closedSkill = role.gap.find((skill) => step.closesSkillIds.includes(skill.skillId));
                const sdgLink = step.sdgTarget ? role.sdg.find((link) => link.target === step.sdgTarget) : undefined;
                return (
                  <li key={step.itemId} className="relative grid grid-cols-[32px_1fr] gap-x-5 pb-4 last:pb-0">
                    <span
                      aria-hidden
                      className="relative z-10 mt-7 size-[30px] self-start justify-self-center rounded-full bg-card ring-4 ring-ink"
                    />
                    <article className="rounded-[28px] bg-card p-6 sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 font-mono text-[12px] tracking-[0.04em] text-grey uppercase">
                        <span className="min-w-0 break-words">{t("pathway.stopLabel", { n: String(index + 1).padStart(2, "0"), provider: providerName })}</span>
                        <span className="min-w-0 sm:text-right">
                          {weeksLabel} ·{" "}
                          {displayHours != null ? (
                            t("pathway.hoursShort", { hours: String(displayHours) })
                          ) : (
                            <span>{t("pathway.hoursNotListed")}</span>
                          )}
                        </span>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-4">
                        <h3 className="min-w-0 font-sans text-[22px] leading-tight font-bold">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => setExpandedId((current) => (current === step.itemId ? null : step.itemId))}
                            className="text-left hover:underline"
                          >
                            {title}
                          </button>
                        </h3>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 items-center gap-1 font-mono text-[12px] tracking-[0.04em] text-grey uppercase hover:text-ink"
                        >
                          {t("pathway.open")}
                          <ArrowUpRight className="size-3.5" strokeWidth={1.6} />
                        </a>
                      </div>

                      {closedSkill && (
                        <p className="mt-2 text-[14px] leading-snug text-grey">
                          {t("pathway.closes")}: <span className="font-bold text-ink">{closedSkill.label}</span>
                        </p>
                      )}
                      {expanded && (
                        <>
                          <Perforation className="my-5" />
                          <p className="text-[14px] leading-relaxed text-grey">
                            {step.why}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-paper px-3 py-1 font-mono text-[11px] tracking-[0.04em] text-ink uppercase">
                              {t(COST_LABEL_KEY[item.costType])}
                            </span>
                            {sdgLink && (
                              <SdgChip>{`SDG ${sdgLink.target} ${targetLabels[sdgLink.target] ?? sdgLink.target}`.trim()}</SdgChip>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
            {plan.steps.length > VISIBLE_STOPS && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-2 pl-12 font-mono text-[12px] tracking-[0.04em] text-grey uppercase hover:text-ink"
              >
                {t("pathway.moreStops", { count: String(plan.steps.length - VISIBLE_STOPS) })}
              </button>
            )}
          </section>

          {/* Sticky skill-gap side */}
          <aside className="order-1 flex flex-col gap-4 md:order-2 md:sticky md:top-6 md:self-start">
            <div className="rounded-[40px] bg-card p-8">
              <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("pathway.yourSkillGap")}</p>
              <p className="mt-3 font-serif text-[72px] leading-none tabular-nums">
                {closedSkillIds.size}/{role.gap.length}
              </p>
              <ul className="mt-5 space-y-2.5 text-[15px]">
                {role.gap.map((skill) => {
                  const covered = closedSkillIds.has(skill.skillId);
                  return (
                    <li key={skill.skillId} className={cn("flex items-start gap-2.5", !covered && "text-grey/60")}>
                      <span aria-hidden className="mt-1.5 text-[10px]">
                        {covered ? "●" : "○"}
                      </span>
                      <span>{skill.label}</span>
                    </li>
                  );
                })}
              </ul>
              <Perforation className="my-6" />
              <SdgChip>{`SDG ${role.sdg.map((link) => link.target).join(" · ")}`}</SdgChip>
              {firstUrl && (
                <a
                  href={firstUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 flex w-full items-center justify-center rounded-full bg-sage px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:bg-sage/90"
                >
                  {t("pathway.startStop", { n: "01" })}
                </a>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="mt-4 flex items-center gap-1.5 text-[13px] text-grey underline underline-offset-4 hover:text-ink"
              >
                <Trash2 className="size-3.5" strokeWidth={1.6} />
                {t("pathway.deleteMyData")}
              </button>
            </div>
            <IllustrationPanel src="/illustrations/u1.svg" panel="plasma" className="h-[240px]" />
          </aside>
        </div>

        <SourceRow
          className="mt-14"
          sources={[
            {
              label: t("pathway.catalogueChecked", {
                date: catalogueDate ? formatDayMonthYear(catalogueDate, t) : missingValue(t("common.notAvailable")),
              }),
            },
          ]}
        />
      </main>

      {/* window.print() surface: all stops expanded, no chrome (globals.css @media print). */}
      <section className="print-only">
        <h1 className="print-h1">{t("pathway.printTitle", { title: role.title })}</h1>
        <p>
          {t("pathway.printDate", {
            date: new Date().toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })}
        </p>
        <ol>
          {plan.steps.map((step, index) => {
            const item = resolveItem(step);
            if (!item) return null;
            const providerName = "provider" in item ? item.provider : item.agency;
            const weeksLabel =
              step.weekStart === step.weekEnd
                ? t("pathway.week", { week: String(step.weekStart) })
                : t("pathway.weeksRange", { start: String(step.weekStart), end: String(step.weekEnd) });
            return (
              <li key={step.itemId} className="print-ticket">
                <span className="print-num">{index + 1}</span>
                <span className="print-name">{"title" in item ? item.title : item.name}</span>
                <span>{providerName}</span>
                <span>{weeksLabel}</span>
                <span>{t(COST_LABEL_KEY[item.costType])}</span>
                <span className="print-url">{item.url}</span>
              </li>
            );
          })}
        </ol>
        <footer className="print-foot">
          <p>{t("footer.disclaimer")}</p>
          <p>{t("pathway.printSources")}</p>
        </footer>
      </section>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[12px] tracking-[0.06em] text-limestone/70 uppercase">{label}</dt>
      <dd className="mt-1.5 font-serif text-[clamp(26px,3vw,44px)] leading-[0.95] [overflow-wrap:anywhere] lg:[overflow-wrap:normal]">{value}</dd>
    </div>
  );
}
