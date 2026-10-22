// Pathway: the chosen role's skill gap turned into a week-by-week route,
// built from the curated courses and programmes in data/*.csv.
"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Building2,
  CircleCheck,
  CircleHelp,
  CircleSlash,
  Clock3,
  Download,
  Gift,
  GraduationCap,
  HandCoins,
  Landmark,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { EstimateFooter } from "@/components/estimate-footer";
import { CountUp, EASE_OUT, Reveal } from "@/components/motion";
import { SdgBadge } from "@/components/sdg-badge";
import { SdgLegend } from "@/components/sdg-legend";
import { SourceChip } from "@/components/source-chip";
import { Disclosure } from "@/components/ui/disclosure";
import { InfoPopover } from "@/components/ui/info-popover";
import { useFlow } from "@/context/flow-context";
import { buildPathwayPlan, programmeEligibilityStatus } from "@/lib/pathway";
import { useRoles } from "@/lib/use-roles";
import { cn } from "@/lib/utils";
import type { Course, CostType, CourseAiContent, PlanStep, Programme } from "@/types/contracts";

/** Course-card badge for ai_content. "none" shows nothing, and this never
 * applies to the AI untuk Rakyat programme step (programmes have no
 * aiContent field; only step.kind === "course" items are checked below). */
const AI_CONTENT_BADGE: Partial<Record<CourseAiContent, string>> = {
  ai: "AI",
  digital: "数字工具",
};

const COST_LABEL: Record<CostType, string> = {
  free: "Free",
  subsidised: "Subsidised",
  hrdcorp_claimable: "HRD Corp claimable",
  paid: "Paid",
};

const COST_CLASS: Record<CostType, string> = {
  free: "bg-sage-soft text-sage-dark",
  subsidised: "bg-sage-wash text-sage-dark",
  hrdcorp_claimable: "bg-alt text-ink",
  paid: "bg-alt text-grey",
};

const COST_ICON: Record<CostType, typeof Gift> = {
  free: Gift,
  subsidised: HandCoins,
  hrdcorp_claimable: Building2,
  paid: Wallet,
};

const LANGUAGE_LABEL: Record<string, string> = { en: "EN", ms: "BM", zh: "中文" };

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
  const { hydrated, consent, profile, interviewAnswers, chosenRoleId, setChosenRoleId, resetFlow } = useFlow();
  const { state, retry } = useRoles(profile, interviewAnswers.impact_interest);
  const data = state.status === "ready" ? state.data : null;

  const roleId = searchParams.get("role") ?? chosenRoleId;
  const role = roleId && data ? (data.roles.find((item) => item.occupationId === roleId) ?? null) : null;
  const breakdown = role && data ? data.breakdown[role.occupationId] : null;
  const targetLabels = data?.targetLabels ?? {};
  const studyLanguages = profile?.courseLanguages ?? ["en" as const];
  const hoursPerWeek = interviewAnswers.hours_per_week ?? 6;

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
      <div className="pb-32 sm:pb-20">
        <main className="mx-auto max-w-[1248px] px-4 pt-10 sm:px-6">
          {state.status === "loading" && (
            <p className="text-[14px] text-grey" aria-live="polite">
              Building your plan…
            </p>
          )}
          {state.status === "error" && (
            <div className="panel p-6 text-[14px]" role="alert">
              <p className="font-medium">We couldn&rsquo;t load your roles right now.</p>
              <p className="mt-1 text-grey">{state.message}</p>
              <button type="button" onClick={retry} className="btn-secondary mt-4">
                Try again
              </button>
            </div>
          )}
          {state.status === "ready" && (
            <div className="panel p-6 text-[14px]">
              <p className="font-medium">That role isn&rsquo;t in your results.</p>
              <p className="mt-1 text-grey">Pick one of the roles ranked for your profile.</p>
              <button type="button" onClick={() => router.push("/results")} className="btn-secondary mt-4">
                <ArrowLeft className="size-4" strokeWidth={1.6} />
                Back to roles
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  function resolveItem(step: PlanStep): Course | Programme | null {
    if (step.kind === "course") return courses.find((course) => course.id === step.itemId) ?? null;
    return programmes.find((programme) => programme.id === step.itemId) ?? null;
  }

  const totalWeeks = plan.steps.reduce((max, step) => Math.max(max, step.weekEnd), 0);
  const closedSkillIds = new Set(plan.steps.flatMap((step) => step.closesSkillIds));
  const costCounts = plan.steps.reduce(
    (counts, step) => {
      const item = resolveItem(step);
      if (item) counts[item.costType] = (counts[item.costType] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<CostType, number>>,
  );
  const mostlyFree = (costCounts.free ?? 0) >= plan.steps.length / 2;
  const languagesLabel = studyLanguages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ");

  function handleDownload() {
    toast("Download isn't available in this demo. Use your browser's print or a screenshot instead.");
  }

  function handleDelete() {
    resetFlow();
    router.push("/");
  }

  return (
    <div className="pb-32 sm:pb-20">
      <main className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="flex flex-col gap-5 pt-10 pb-8 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p className="text-[13px] text-grey">{profile.name || "Your profile"}</p>
            <h1 className="mt-1 font-serif text-[34px] leading-[1.05] font-medium tracking-tight text-balance md:text-[44px]">
              Your {totalWeeks}-week route to {role.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => router.push("/results")} className="btn-secondary">
              <ArrowLeft className="size-4" strokeWidth={1.6} />
              Back to roles
            </button>
            <button type="button" onClick={handleDownload} className="btn-primary">
              <Download className="size-4" strokeWidth={1.6} />
              Download PDF
            </button>
          </div>
        </motion.section>

        {/* Summary row */}
        <motion.dl
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT }}
          className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6 md:grid-cols-4"
        >
          <div>
            <dt className="text-[12px] text-grey">Duration</dt>
            <dd className="mt-1 font-serif text-[32px] leading-none font-medium tracking-tight">
              <CountUp value={totalWeeks} /> <span className="text-[18px] text-grey">weeks</span>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-grey">Pace</dt>
            <dd className="mt-1 font-serif text-[32px] leading-none font-medium tracking-tight">
              {hoursPerWeek} <span className="text-[18px] text-grey">h a week</span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[12px] text-grey">
              Cost
              <InfoPopover label="Cost types">
                <span className="flex flex-wrap gap-1.5">
                  {(Object.keys(COST_LABEL) as CostType[]).map((type) => {
                    const Icon = COST_ICON[type];
                    return (
                      <span key={type} className={cn("tag", COST_CLASS[type])}>
                        <Icon className="size-3" strokeWidth={1.6} />
                        {COST_LABEL[type]}
                      </span>
                    );
                  })}
                </span>
                <span className="mt-2 block">Ordered free first. Links come from the Laluan checked catalogue.</span>
              </InfoPopover>
            </dt>
            <dd className={cn("mt-1 font-serif text-[32px] leading-none font-medium tracking-tight", mostlyFree && "text-sage")}>
              {mostlyFree ? "Mostly free" : "Mixed cost"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-grey">Skills closed</dt>
            <dd className="mt-1 font-serif text-[32px] leading-none font-medium tracking-tight tabular-nums">
              <CountUp value={closedSkillIds.size} /> <span className="text-[18px] text-grey">of {role.gap.length}</span>
            </dd>
          </div>
        </motion.dl>

        <section className="mt-10 grid grid-cols-1 items-start gap-10 md:grid-cols-12">
          {/* Timeline */}
          <div className="md:col-span-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif text-[28px] font-medium tracking-tight">Week by week</h2>
                <InfoPopover label="How this plan was built">
                  Only items in {languagesLabel} that fit {hoursPerWeek} h a week. Free first, then subsidised, HRD Corp
                  claimable, then paid. Eligibility is checked by rules against your answers; a missing answer shows
                  &ldquo;Check eligibility&rdquo;. Steps are ordered by fixed rules, not by AI.
                </InfoPopover>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-grey">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="size-3.5" strokeWidth={1.6} />
                  Course
                </span>
                <span className="flex items-center gap-1.5">
                  <Landmark className="size-3.5" strokeWidth={1.6} />
                  Government programme
                </span>
              </div>
            </div>

            <RouteTimeline>
                {plan.steps.map((step, index) => {
                  const item = resolveItem(step);
                  if (!item) return null;
                  const sdgLink = step.sdgTarget ? role.sdg.find((link) => link.target === step.sdgTarget) : undefined;
                  const closedSkill = role.gap.find((skill) => step.closesSkillIds.includes(skill.skillId));
                  const providerName = "provider" in item ? item.provider : item.agency;
                  const weeksLabel =
                    step.weekStart === step.weekEnd ? `Week ${step.weekStart}` : `Weeks ${step.weekStart} to ${step.weekEnd}`;
                  const eligibility = step.kind === "program" ? programmeEligibilityStatus(item as Programme, interviewAnswers) : null;
                  const CostIcon = COST_ICON[item.costType];
                  const aiContentBadge = step.kind === "course" ? AI_CONTENT_BADGE[(item as Course).aiContent] : undefined;
                  return (
                    <li key={step.itemId} className="grid grid-cols-[32px_1fr] gap-x-4">
                      {/* z-10 keeps the station above the route line drawn behind the list */}
                      <Reveal className="relative z-10 flex justify-center pt-5">
                        <span className="flex size-8 items-center justify-center rounded-full border-2 border-sage bg-paper font-serif text-[14px] font-medium tabular-nums">
                          {index + 1}
                        </span>
                      </Reveal>
                      <Reveal delay={0.05}>
                        <article className="panel p-5 transition-[border-color] hover:border-grey/40">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-grey">
                            <span className="flex items-center gap-1.5">
                              {step.kind === "course" ? (
                                <GraduationCap className="size-3.5" strokeWidth={1.6} />
                              ) : (
                                <Landmark className="size-3.5" strokeWidth={1.6} />
                              )}
                              {providerName}
                            </span>
                            <span className="tabular-nums">{weeksLabel}</span>
                          </div>
                          <h3 className="mt-2 font-serif text-[22px] leading-tight font-medium">
                            {"title" in item ? item.title : item.name}
                          </h3>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                            <span className={cn("tag", COST_CLASS[item.costType])}>
                              <CostIcon className="size-3" strokeWidth={1.6} />
                              {COST_LABEL[item.costType]}
                            </span>
                            {aiContentBadge && <span className="tag font-sans text-[11px] font-medium text-ink">{aiContentBadge}</span>}
                            <span className="flex items-center gap-1 text-grey">
                              <Clock3 className="size-3.5" strokeWidth={1.6} />
                              {"hours" in item ? `${item.hours} h` : <span className="text-xs text-grey">Hours not listed</span>}
                            </span>
                            {closedSkill && (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Target className="size-3.5 shrink-0 text-sage" strokeWidth={1.6} />
                                <span className="text-grey">Closes</span> <span className="font-medium">{closedSkill.label}</span>
                              </span>
                            )}
                            {eligibility === "check" && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-ink/60 px-2 py-0.5 text-[11px] font-medium text-ink">
                                <CircleHelp className="size-3" strokeWidth={1.6} />
                                Check eligibility
                              </span>
                            )}
                          </div>

                          <Disclosure
                            className="mt-4"
                            summary={<span className="text-[13px] text-grey hover:text-ink">Details</span>}
                            summaryClassName="justify-start gap-1"
                            contentClassName="mt-3 space-y-3 text-[13px]"
                          >
                            <p className="leading-relaxed text-grey">{step.why}</p>

                            {eligibility === "pass" && (
                              <p className="flex items-center gap-1.5 text-[12px] text-sage-dark">
                                <CircleCheck className="size-3.5" strokeWidth={1.6} />
                                Eligible based on your answers
                              </p>
                            )}
                            {eligibility === "fail" && <p className="text-[12px] text-grey">Not eligible based on your answers.</p>}
                            {eligibility === "check" && (
                              <p className="text-[12px] text-grey">We don&rsquo;t know yet whether you meet every rule for this programme.</p>
                            )}

                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-grey">
                              {"languages" in item && (
                                <span>Languages: {item.languages.map((language) => LANGUAGE_LABEL[language] ?? language).join(", ")}</span>
                              )}
                              {"certificate" in item && (
                                <span className="flex items-center gap-1">
                                  {item.certificate ? <Award className="size-3.5" strokeWidth={1.6} /> : <CircleSlash className="size-3.5" strokeWidth={1.6} />}
                                  {item.certificate ? "Certificate" : "No certificate"}
                                </span>
                              )}
                              {sdgLink && (
                                <span className="flex items-center gap-1.5">
                                  SDG <SdgBadge link={sdgLink} label={targetLabels[sdgLink.target] ?? sdgLink.target} />
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <SourceChip
                                source={{
                                  dataset: providerName,
                                  releaseDate: item.lastChecked,
                                  url: item.url,
                                  asOf: item.lastChecked,
                                }}
                              />
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[12px] text-grey underline underline-offset-4 hover:text-ink"
                              >
                                Open source
                                <ArrowUpRight className="size-3" strokeWidth={1.6} />
                              </a>
                            </div>
                          </Disclosure>
                        </article>
                      </Reveal>
                    </li>
                  );
                })}
            </RouteTimeline>
          </div>

          {/* Side panel */}
          <Reveal delay={0.2} className="md:sticky md:top-24 md:col-span-4">
            <div className="panel space-y-6 p-6">
              <div>
                <p className="flex items-baseline justify-between text-[12px] text-grey">
                  Your skill gap
                  <span className="font-serif text-[18px] font-medium text-ink">
                    {closedSkillIds.size} <span className="font-sans text-[12px] font-normal text-grey">of {role.gap.length} covered</span>
                  </span>
                </p>
                <ul className="mt-3 space-y-2 text-[13px]">
                  {role.gap.map((skill) => {
                    const stepIndex = plan.steps.findIndex((step) => step.closesSkillIds.includes(skill.skillId));
                    return (
                      <li key={skill.skillId} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {stepIndex >= 0 ? (
                            <CircleCheck className="size-4 shrink-0 text-sage" strokeWidth={1.6} />
                          ) : (
                            <CircleSlash className="size-4 shrink-0 text-grey/60" strokeWidth={1.6} />
                          )}
                          {skill.label}
                        </span>
                        <span className="shrink-0 text-[11px] whitespace-nowrap text-grey">
                          {stepIndex >= 0 ? `Step ${stepIndex + 1}` : "Not in this plan"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border-t border-line pt-5">
                <p className="text-[12px] text-grey">SDG targets this move advances</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                  {role.sdg.map((link) => (
                    <SdgBadge key={link.target} link={link} label={targetLabels[link.target] ?? link.target} />
                  ))}
                </div>
                <div className="mt-3">
                  <SdgLegend />
                </div>
              </div>

              <div className="border-t border-line pt-5 text-[12px] text-grey">
                <p>
                  Built for {languagesLabel}, {hoursPerWeek} h a week, free first.
                  {role.robust ? " This role is robust in all 3 futures." : ""}
                </p>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="mt-4 flex items-center gap-1.5 underline underline-offset-4 hover:text-ink"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.6} />
                  Delete my data
                </button>
              </div>
            </div>
          </Reveal>
        </section>

        <p className="mt-10 text-[12px] leading-relaxed text-grey/80">
          Catalogue items were checked by the team on the date shown on each step. Weeks are estimated from listed
          hours at your pace. Confirm cost and eligibility on the provider&rsquo;s site before you enrol.
        </p>
      </main>
      <EstimateFooter />
    </div>
  );
}

/** The route down the timeline: a sage line that follows the scroll position. */
function RouteTimeline({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 0.75", "end 0.75"] });
  const lineProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <div className="relative">
      <span aria-hidden className="absolute top-4 bottom-4 left-[15px] w-px bg-line" />
      <motion.span
        aria-hidden
        className="absolute top-4 bottom-4 left-[15px] w-px origin-top bg-sage"
        style={{ scaleY: reduce ? 1 : lineProgress }}
      />
      <ol ref={listRef} className="space-y-3">
        {children}
      </ol>
    </div>
  );
}
