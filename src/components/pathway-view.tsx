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
import { buildPathwayPlan, courseLanguagePill, missingChineseCourse } from "@/lib/pathway";
import { pathwayStopLeg, pathwayTicketNumber, sdgGoalNumbers, shortCourseUrl } from "@/lib/pathway-print";
import { pathwaySdgTotal } from "@/lib/sdg-total";
import { skillSdg } from "@/lib/skill-sdg";
import { useRoles } from "@/lib/use-roles";
import { cn } from "@/lib/utils";
import type { Course, CostType, PlanStep, Programme } from "@/types/contracts";

const COST_LABEL_KEY: Record<CostType, MessageKey> = {
  free: "pathway.cost.free",
  subsidised: "pathway.cost.subsidised",
  hrdcorp_claimable: "pathway.cost.hrdcorpClaimable",
  paid: "pathway.cost.paid",
};

const LEG_KEY: Record<ReturnType<typeof pathwayStopLeg>, MessageKey> = {
  board: "pathway.print.leg.board",
  skillUp: "pathway.print.leg.skillUp",
  arrive: "pathway.print.leg.arrive",
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

  const planCourses = plan.steps
    .filter((step) => step.kind === "course")
    .map((step) => resolveItem(step))
    .filter((item): item is Course => item !== null && "title" in item);
  const sdgTotal = pathwaySdgTotal(planCourses, role.sdg);

  // One note under THE LINE when Chinese is selected and some step had to fall
  // back to a course in none of the selected languages.
  const englishFallbackStepIds = new Set(
    plan.steps
      .filter((step) => {
        if (step.kind !== "course") return false;
        const item = resolveItem(step);
        return (
          !!item &&
          "languages" in item &&
          !item.languages.some((language) => studyLanguages.includes(language)) &&
          missingChineseCourse(step.closesSkillIds, courses, studyLanguages)
        );
      })
      .map((step) => step.itemId),
  );
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

  // Print ticket ("Download PDF") values.
  const totalHours = plan.steps.reduce((sum, step) => {
    const item = resolveItem(step);
    const hours = step.merged?.hours ?? (item && "hours" in item ? item.hours : undefined);
    return sum + (hours ?? 0);
  }, 0);
  const closedSkills = role.gap.filter((skill) => closedSkillIds.has(skill.skillId));
  const sdgGoals = sdgGoalNumbers(sdgTotal.goals.flatMap((goal) => goal.targets.map((target) => target.target)));
  const ticketNumber = pathwayTicketNumber(role.occupationId);
  const printDate = new Date().toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
              <h1 className="mt-5 font-serif text-[clamp(32px,5.9vw,76px)] leading-[1.1] text-balance uppercase">
                {t("pathway.heroHeading", { weeks: String(totalWeeks), title: role.title })}
              </h1>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-7 [&>div]:min-w-0">
              {/* Mobile: Pace | Stops, then Cost and Skills closed on full rows. sm+: 2x2. */}
              <HeroStat className="max-sm:order-1" label={t("pathway.pace")} value={t("pathway.hoursPerWeek", { hours: String(hoursPerWeek) })} />
              <HeroStat
                className="max-sm:order-3 max-sm:col-span-2"
                label={t("pathway.cost")} value={mostlyFree ? t("pathway.mostlyFree") : t("pathway.mixedCost")} nowrap />
              <HeroStat
                className="max-sm:order-4 max-sm:col-span-2"
                label={t("pathway.skillsClosed")}
                value={`${closedSkillIds.size} ${t("pathway.ofTotal", { count: String(role.gap.length) })}`}
              />
              <HeroStat className="max-sm:order-2" label={t("pathway.stops")} value={String(plan.steps.length)} />
            </dl>
          </div>
        </motion.section>

        {/* The line + sticky side */}
        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_380px] md:items-start md:gap-12">
          {/* The line */}
          <section className="order-2 md:order-1">
            <h2 className="font-serif text-[clamp(40px,8vw,64px)] leading-[0.95] uppercase">{t("pathway.theLine")}</h2>
            {englishFallbackStepIds.size > 0 && (
              <p data-testid="no-chinese-course" className="mt-3 font-mono text-[12px] tracking-[0.02em] text-grey">
                {t("pathway.noChineseCourse")}
              </p>
            )}
            <ol className="relative mt-8 pl-6 sm:pl-12">
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
                const languagePill = "languages" in item ? courseLanguagePill(item.languages, studyLanguages) : null;
                const sdgLink = step.sdgTarget ? role.sdg.find((link) => link.target === step.sdgTarget) : undefined;
                return (
                  <li key={step.itemId} className="relative grid grid-cols-[20px_1fr] gap-x-3 pb-4 last:pb-0 sm:grid-cols-[32px_1fr] sm:gap-x-5">
                    <span
                      aria-hidden
                      className="relative z-10 mt-7 size-5 self-start sm:size-[30px] justify-self-center rounded-full bg-card ring-4 ring-ink"
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
                      <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
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
                          {languagePill && (
                            <span
                              data-testid="course-language-pill"
                              lang="en"
                              className="inline-block shrink-0 rounded-full border border-ink/30 px-2 py-0.5 align-middle font-mono text-[10px] font-normal tracking-[0.04em] text-grey uppercase"
                            >
                              {languagePill}
                            </span>
                          )}
                        </div>
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
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-snug text-grey">
                          <span>
                            {t("pathway.closes")}: <span className="font-bold text-ink">{closedSkill.label}</span>
                          </span>
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
                  const sdg = skillSdg(skill.skillId);
                  return (
                    <li key={skill.skillId} className={cn("flex items-start gap-2.5", !covered && "text-grey/60")}>
                      <span aria-hidden className="mt-1.5 text-[10px]">
                        {covered ? "●" : "○"}
                      </span>
                      <span>
                        <span>{skill.label}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-grey/80">
                          {sdg
                            ? t("skillSdg.target", { target: sdg.target, reason: sdg.reason })
                            : t("skillSdg.noDirectLink")}
                        </span>
                      </span>
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

        <section className="mt-14" data-testid="pathway-sdg-total">
          <h2 className="font-serif text-[clamp(28px,4vw,40px)] leading-[0.95] uppercase">
            {t("pathway.sdgTotalTitle")}
          </h2>
          {sdgTotal.goals.length === 0 ? (
            <p className="mt-3 text-[14px] text-grey">{t("pathway.sdgTotalEmpty")}</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {sdgTotal.goals.map((goal) => (
                <li key={goal.goal} className="rounded-[28px] bg-card p-6">
                  <p className="font-mono text-[12px] tracking-[0.04em] text-grey uppercase">
                    {t("pathway.sdgTotalGoal", { goal: String(goal.goal), count: String(goal.count) })}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {goal.targets.map((target) => (
                      <li key={target.target}>
                        <p className="text-[14px] font-bold">
                          {t("pathway.sdgTotalTarget", { target: target.target, count: String(target.count) })}
                        </p>
                        {target.roleReason && (
                          <p className="mt-1 text-[13px] leading-snug text-grey">
                            {t("pathway.sdgTotalRoleReason", { reason: target.roleReason })}
                          </p>
                        )}
                        {target.courses.length > 0 && (
                          <ul className="mt-2 space-y-2">
                            {target.courses.map((course) => (
                              <li key={course.id}>
                                <p className="text-[14px] font-bold">{course.title}</p>
                                <p className="text-[13px] leading-snug text-grey">{course.reason}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

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

      {/* window.print() surface ("Download PDF"): Laluan pathway ticket, mock v2
          (docs/design/Laluan-Pathway-Download-PDF-mock-v2.png). Styles: globals.css @media print. */}
      <section className="print-only" data-testid="pathway-print">
        <div className="pp-brand">
          <span className="pp-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/laluan-mark.svg" alt="" width={22} height={22} />
            Laluan
          </span>
          <p className="pp-gen pp-mono">
            {t("pathway.print.generated", { date: printDate })}
            <br />
            {t("pathway.print.notSaved")}
          </p>
        </div>

        <div className="pp-hero">
          <span aria-hidden className="pp-orb pp-orb-a" />
          <span aria-hidden className="pp-orb pp-orb-b" />
          <span aria-hidden className="pp-orb pp-orb-c" />
          <div className="pp-pills">
            <span className="pp-pill pp-mono">{t("pathway.print.ticket", { number: ticketNumber })}</span>
            {sdgGoals.length > 0 && (
              <span className="pp-pill pp-mono">{sdgGoals.map((goal) => `SDG ${goal}`).join(" · ")}</span>
            )}
          </div>
          <div className="pp-route">
            <span aria-hidden className="pp-dot" />
            <span className="pp-route-text pp-mono">
              {t("pathway.print.route", { from: fromRole ?? t("pathway.print.today"), to: role.title })}
            </span>
            <span aria-hidden className="pp-dot" />
          </div>
          <div className="pp-meta">
            <span className="pp-chip">
              {plan.steps.length === 1
                ? t("pathway.print.courseOne")
                : t("pathway.print.courseMany", { count: String(plan.steps.length) })}
            </span>
            {totalHours > 0 && <span className="pp-chip">{t("pathway.print.hours", { hours: String(Math.round(totalHours)) })}</span>}
            <span className="pp-chip">
              {totalWeeks === 1 ? t("pathway.print.weekOne") : t("pathway.print.weekMany", { weeks: String(totalWeeks) })}
            </span>
            <span className="pp-chip">{t("pathway.hoursPerWeek", { hours: String(hoursPerWeek) })}</span>
          </div>
        </div>

        <h2 className="pp-section">{t("pathway.print.section")}</h2>
        <ol className="pp-stops">
          {plan.steps.map((step, index) => {
            const item = resolveItem(step);
            if (!item) return null;
            const title = "title" in item ? item.title : item.name;
            const providerName = "provider" in item ? item.provider : item.agency;
            const weeksLabel =
              step.weekStart === step.weekEnd
                ? t("pathway.week", { week: String(step.weekStart) })
                : t("pathway.weeksRange", { start: String(step.weekStart), end: String(step.weekEnd) });
            const displayHours = step.merged?.hours ?? ("hours" in item ? item.hours : undefined);
            const related = role.gap.find((skill) => step.closesSkillIds.includes(skill.skillId));
            const languagePill = "languages" in item ? courseLanguagePill(item.languages, studyLanguages) : null;
            const leg = pathwayStopLeg(index, plan.steps.length);
            return (
              <li key={step.itemId} className="pp-stop">
                <div className="pp-stop-top">
                  <span className={cn("pp-num", index % 2 === 0 ? "pp-orange" : "pp-indigo")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="pp-info">
                    <p className="pp-title">
                      {title}
                      {languagePill && <span className="pp-lang pp-mono">{languagePill}</span>}
                    </p>
                    <p className="pp-provider">
                      {providerName} · {weeksLabel}
                      {displayHours != null ? ` · ${t("pathway.hoursShort", { hours: String(displayHours) })}` : ""}
                    </p>
                    {related && (
                      <p className="pp-closes">
                        {t("pathway.closes")}: <strong>{related.label}</strong>
                      </p>
                    )}
                    <a className="pp-link" href={item.url}>
                      {shortCourseUrl(item.url)}
                    </a>
                  </div>
                  <span className={cn("pp-badge", `pp-badge-${item.costType}`)}>{t(COST_LABEL_KEY[item.costType])}</span>
                </div>
                <div className="pp-stub">
                  <span className="pp-stub-label pp-mono">
                    {t("pathway.print.stop", { n: String(index + 1), leg: t(LEG_KEY[leg]) })}
                  </span>
                  <span aria-hidden className="pp-stub-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="pp-notice">{t("pathway.print.notice")}</p>

        {closedSkills.length > 0 && (
          <div className="pp-skills">
            <span className="pp-skills-k pp-mono">{t("pathway.print.skills")}</span>
            {closedSkills.map((skill) => (
              <span key={skill.skillId} className="pp-skill">
                {skill.label}
              </span>
            ))}
          </div>
        )}

        <footer className="print-foot">
          <p>{t("pathway.print.footer")}</p>
          <p className="pp-fine">
            {t("footer.disclaimer")} {t("pathway.printSources")}
          </p>
        </footer>
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  nowrap = false,
  className,
}: {
  label: string;
  value: string;
  nowrap?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[12px] tracking-[0.06em] text-limestone/70 uppercase">{label}</dt>
      <dd className="mt-1.5 font-serif text-[clamp(26px,3vw,44px)] leading-[0.95] [overflow-wrap:anywhere] lg:[overflow-wrap:normal]">
        {/* nowrap on mobile only (its row is full-width there); desktop may wrap. */}
        {nowrap ? <span className="max-sm:whitespace-nowrap">{value}</span> : value}
      </dd>
    </div>
  );
}
