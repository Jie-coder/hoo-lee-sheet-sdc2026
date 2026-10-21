// Pathway: the chosen role's skill gap turned into a week-by-week plan,
// built from the mock course/programme catalogue (src/mocks/catalogue.ts).
"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Building2,
  CalendarCheck,
  CircleCheck,
  CircleHelp,
  CircleSlash,
  Clock3,
  Download,
  Filter,
  Gift,
  GraduationCap,
  Hand,
  HandCoins,
  Landmark,
  Languages,
  Link as LinkIcon,
  ListOrdered,
  ShieldCheck,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { EstimateFooter } from "@/components/estimate-footer";
import { SdgBadge } from "@/components/sdg-badge";
import { SdgLegend } from "@/components/sdg-legend";
import { SourceChip } from "@/components/source-chip";
import { useFlow } from "@/context/flow-context";
import { formatDayMonthYear } from "@/lib/display";
import { buildPathwayPlan, programmeEligibilityStatus } from "@/lib/pathway";
import { cn } from "@/lib/utils";
import { AISYAH_RESULTS } from "@/mocks/aisyah";
import { COURSES, PROGRAMMES } from "@/mocks/catalogue";
import type { Course, CostType, PlanStep, Programme } from "@/types/contracts";

const COST_LABEL: Record<CostType, string> = {
  free: "Free",
  subsidised: "Subsidised",
  hrdcorp_claimable: "HRD Corp claimable",
  paid: "Paid",
};

const COST_CLASS: Record<CostType, string> = {
  free: "bg-sage-soft text-sage-dark",
  subsidised: "border border-sage text-sage-dark",
  hrdcorp_claimable: "border border-line bg-alt text-ink",
  paid: "border border-line text-grey",
};

const COST_ICON: Record<CostType, typeof Gift> = {
  free: Gift,
  subsidised: HandCoins,
  hrdcorp_claimable: Building2,
  paid: Wallet,
};

const LANGUAGE_LABEL: Record<string, string> = { en: "EN", ms: "BM", zh: "中文" };

export function PathwayView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrated, consent, profile, interviewAnswers, chosenRoleId, setChosenRoleId, resetFlow } = useFlow();

  const roleId = searchParams.get("role") ?? chosenRoleId;
  const role = roleId ? (AISYAH_RESULTS.today.response.roles.find((item) => item.occupationId === roleId) ?? null) : null;
  const studyLanguages = profile?.courseLanguages ?? ["en" as const];
  const hoursPerWeek = interviewAnswers.hours_per_week ?? 6;

  const studyLanguagesKey = studyLanguages.join(",");
  const plan = useMemo(() => {
    if (!role) return null;
    return buildPathwayPlan({
      role,
      courses: COURSES,
      programmes: PROGRAMMES,
      studyLanguages,
      hoursPerWeek,
      skillLinks: AISYAH_RESULTS.today.skillLinks,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- studyLanguagesKey is the stable form of studyLanguages
  }, [role, studyLanguagesKey, hoursPerWeek]);

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

  if (!profile || !role || !plan) return null;

  function resolveItem(step: PlanStep): Course | Programme | null {
    if (step.kind === "course") return COURSES.find((course) => course.id === step.itemId) ?? null;
    return PROGRAMMES.find((programme) => programme.id === step.itemId) ?? null;
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

  function handleDownload() {
    toast("Download isn't available in this demo — use your browser's print or screenshot instead.");
  }

  function handleDelete() {
    resetFlow();
    router.push("/");
  }

  return (
    <div className="bg-paper pb-32 text-ink sm:pb-16">
      <main className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <section className="flex flex-col gap-4 pt-7 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] text-grey">
              {profile.name || "Your profile"} <span className="text-grey/60">→</span>{" "}
              <span className="text-ink">{role.title}</span>
            </p>
            <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-medium tracking-tight md:text-[36px]">
              Your {totalWeeks}-week path to {role.title}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-grey">
              <Hand className="size-4" strokeWidth={1.6} />
              You chose this role on the results page.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/results")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-btn2 px-4 py-2.5 text-[14px] font-medium whitespace-nowrap"
            >
              <ArrowLeft className="size-4" strokeWidth={1.6} />
              Back to roles
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-white"
            >
              <Download className="size-4" strokeWidth={1.6} />
              Download plan (PDF)
            </button>
          </div>
        </section>

        {/* Summary bar */}
        <section className="rounded-2xl border border-line bg-white px-6 py-5">
          <div className="grid grid-cols-2 gap-x-4 md:grid-cols-4 md:divide-x md:divide-line">
            <div className="py-3 first:pl-0 md:px-6 md:py-0">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">DURATION</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight whitespace-nowrap md:text-[36px]">
                {totalWeeks} weeks
              </p>
              <p className="mt-1.5 text-[12px] text-grey">{plan.steps.length} steps</p>
            </div>
            <div className="py-3 first:pl-0 md:px-6 md:py-0">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">PACE</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight whitespace-nowrap md:text-[36px]">
                {hoursPerWeek} h <span className="text-[20px] text-grey/50 md:text-[24px]">/ week</span>
              </p>
              <p className="mt-1.5 text-[12px] text-grey">Never over {hoursPerWeek} h a week</p>
            </div>
            <div className="py-3 first:pl-0 md:px-6 md:py-0">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">COST</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight whitespace-nowrap md:text-[36px]">
                <span className={mostlyFree ? "text-sage" : undefined}>{mostlyFree ? "Mostly free" : "Mixed cost"}</span>
              </p>
              <p className="mt-1.5 text-[12px] text-grey">
                {(Object.entries(costCounts) as [CostType, number][])
                  .map(([type, count]) => `${count} ${COST_LABEL[type].toLowerCase()}`)
                  .join(" · ")}
              </p>
            </div>
            <div className="py-3 md:px-6 md:py-0">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">SKILLS CLOSED</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight tabular-nums md:text-[36px]">
                {closedSkillIds.size} <span className="text-grey/50">/</span> {role.gap.length}
              </p>
              <div className="mt-2.5 h-1.5 rounded-full bg-alt">
                <div
                  className="h-1.5 rounded-full bg-sage"
                  style={{ width: `${role.gap.length ? Math.round((closedSkillIds.size / role.gap.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col justify-between gap-3 border-t border-line pt-3 md:flex-row md:items-center">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-grey">
              <span className="mr-1">Cost types, in plan order:</span>
              {(Object.keys(COST_LABEL) as CostType[]).map((type) => {
                const Icon = COST_ICON[type];
                return (
                  <span key={type} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px]", COST_CLASS[type])}>
                    <Icon className="size-3" strokeWidth={1.6} />
                    {COST_LABEL[type]}
                  </span>
                );
              })}
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-alt px-2 py-0.5 text-[11px] leading-4 text-grey">
              <CalendarCheck className="size-3" strokeWidth={1.6} />
              Laluan curated catalogue
            </span>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 items-start gap-5 md:grid-cols-12">
          {/* Timeline */}
          <div className="md:col-span-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-serif text-[24px] font-medium tracking-tight">Week by week</h2>
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
            <ol className="space-y-4">
              {plan.steps.map((step, index) => {
                const item = resolveItem(step);
                if (!item) return null;
                const sdgLink = step.sdgTarget ? role.sdg.find((link) => link.target === step.sdgTarget) : undefined;
                const closedSkill = role.gap.find((skill) => step.closesSkillIds.includes(skill.skillId));
                return (
                  <li key={step.itemId} className="grid grid-cols-[32px_1fr] gap-x-4">
                    <div className="flex justify-center">
                      <span className="flex size-8 items-center justify-center rounded-full border border-sage bg-white text-[13px] font-medium tabular-nums">
                        {index + 1}
                      </span>
                    </div>
                    <article className="rounded-2xl border border-line bg-white p-5">
                      <div className="flex items-center justify-between gap-3 text-[12px] text-grey">
                        <span className="flex items-center gap-1.5">
                          {step.kind === "course" ? (
                            <GraduationCap className="size-3.5" strokeWidth={1.6} />
                          ) : (
                            <Landmark className="size-3.5" strokeWidth={1.6} />
                          )}
                          {step.kind === "course" ? "Course" : "Government programme"}
                        </span>
                        <span className="tabular-nums">
                          {step.weekStart === step.weekEnd ? `Week ${step.weekStart}` : `Weeks ${step.weekStart}–${step.weekEnd}`}
                        </span>
                      </div>
                      <h3 className="mt-2 font-serif text-[22px] leading-tight font-medium">
                        {"title" in item ? item.title : item.name}
                      </h3>
                      <p className="mt-0.5 text-[13px] text-grey">{"provider" in item ? item.provider : item.agency}</p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px]", COST_CLASS[item.costType])}>
                          {(() => {
                            const Icon = COST_ICON[item.costType];
                            return <Icon className="size-3" strokeWidth={1.6} />;
                          })()}
                          {COST_LABEL[item.costType]}
                        </span>
                        {"languages" in item &&
                          item.languages.map((language) => (
                            <span
                              key={language}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[12px] text-ink"
                            >
                              <Languages className="size-3 text-grey" strokeWidth={1.6} />
                              {LANGUAGE_LABEL[language] ?? language}
                            </span>
                          ))}
                        {"hours" in item && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[12px] text-ink">
                            <Clock3 className="size-3 text-grey" strokeWidth={1.6} />
                            {item.hours} h
                          </span>
                        )}
                        {"certificate" in item && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[12px] text-ink">
                            {item.certificate ? (
                              <Award className="size-3 text-grey" strokeWidth={1.6} />
                            ) : (
                              <CircleSlash className="size-3 text-grey" strokeWidth={1.6} />
                            )}
                            {item.certificate ? "Certificate" : "No certificate"}
                          </span>
                        )}
                      </div>

                      {closedSkill && (
                        <div className="mt-4 grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto]">
                          <p className="flex items-center gap-1.5 text-[13px]">
                            <Target className="size-4 shrink-0 text-sage" strokeWidth={1.6} />
                            <span className="text-grey">Closes</span> <span className="font-medium">{closedSkill.label}</span>
                          </p>
                          {sdgLink && (
                            <div className="sm:justify-self-end">
                              <SdgBadge link={sdgLink} label={AISYAH_RESULTS.today.targetLabels[sdgLink.target] ?? sdgLink.target} />
                            </div>
                          )}
                        </div>
                      )}

                      <p className="mt-2 text-[13px] leading-relaxed text-grey">{step.why}</p>

                      {step.kind === "program" &&
                        (() => {
                          const status = programmeEligibilityStatus(item as Programme, interviewAnswers);
                          if (status === "pass") {
                            return (
                              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-sage-dark">
                                <CircleCheck className="size-3.5" strokeWidth={1.6} />
                                Eligible based on your answers
                              </p>
                            );
                          }
                          if (status === "fail") {
                            return <p className="mt-3 text-[12px] text-grey">Not eligible based on your answers.</p>;
                          }
                          return (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-ink/70 bg-paper px-3 py-2.5 text-[12px] leading-relaxed">
                              <CircleHelp className="mt-px size-4 shrink-0" strokeWidth={1.6} />
                              <div>
                                <p className="text-[13px] font-medium">Check eligibility</p>
                                <p className="text-grey">We don&rsquo;t know yet whether you meet every rule for this programme.</p>
                              </div>
                            </div>
                          );
                        })()}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <SourceChip
                          source={{
                            dataset: "title" in item ? item.provider : item.agency,
                            releaseDate: item.lastChecked,
                            url: item.url,
                            asOf: item.lastChecked,
                          }}
                        />
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[12px] text-grey underline underline-offset-4"
                        >
                          Open source
                          <ArrowUpRight className="size-3" strokeWidth={1.6} />
                        </a>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Side panel */}
          <aside className="space-y-5 md:col-span-4">
            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">YOUR SKILL GAP</p>
              <p className="mt-1 text-[13px] text-grey">The top skills from your role card, and the step that closes each one.</p>
              <ul className="mt-3 divide-y divide-line border-y border-line text-[13px]">
                {role.gap.map((skill) => {
                  const stepIndex = plan.steps.findIndex((step) => step.closesSkillIds.includes(skill.skillId));
                  return (
                    <li key={skill.skillId} className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2">
                        {stepIndex >= 0 ? (
                          <CircleCheck className="size-4 text-sage" strokeWidth={1.6} />
                        ) : (
                          <CircleSlash className="size-4 text-grey/60" strokeWidth={1.6} />
                        )}
                        {skill.label}
                      </span>
                      <span className="rounded border border-line px-1.5 text-[11px] tabular-nums text-grey">
                        {stepIndex >= 0 ? `Step ${stepIndex + 1}` : "Not in this plan"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">SDG TARGETS THIS MOVE ADVANCES</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                {role.sdg.map((link) => (
                  <SdgBadge key={link.target} link={link} label={AISYAH_RESULTS.today.targetLabels[link.target] ?? link.target} />
                ))}
              </div>
              <div className="mt-3">
                <SdgLegend />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">HOW THIS PLAN WAS BUILT</p>
              <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-grey">
                <li className="flex gap-2">
                  <Filter className="mt-px size-4 shrink-0 text-sage" strokeWidth={1.6} />
                  Only courses in {studyLanguages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")} that fit {hoursPerWeek} h a week.
                </li>
                <li className="flex gap-2">
                  <ListOrdered className="mt-px size-4 shrink-0 text-sage" strokeWidth={1.6} />
                  Free first, then subsidised, then HRD Corp claimable, then paid.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-px size-4 shrink-0 text-sage" strokeWidth={1.6} />
                  Eligibility is checked by rules against your answers. A missing answer shows &ldquo;Check eligibility&rdquo;.
                </li>
                <li className="flex gap-2">
                  <LinkIcon className="mt-px size-4 shrink-0 text-sage" strokeWidth={1.6} />
                  Every link comes from our checked catalogue. AI orders the steps; it never writes a link.
                </li>
              </ul>
              {role.robust && (
                <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-[12px] text-grey">
                  <ShieldCheck className="size-3.5 text-sage" strokeWidth={1.6} />
                  Role is robust in all 3 futures (Results, {formatDayMonthYear(role.signalsAsOf)})
                </p>
              )}
            </div>
          </aside>
        </section>

        <section className="mt-5 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push("/results")}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-btn2 px-4 py-2.5 text-[14px] font-medium"
          >
            <ArrowLeft className="size-4" strokeWidth={1.6} />
            Back to roles
          </button>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center gap-1.5 text-[13px] text-grey underline underline-offset-4"
            >
              <Trash2 className="size-3.5" strokeWidth={1.6} />
              Delete my data
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink px-5 py-2.5 text-[14px] font-medium text-white"
            >
              <Download className="size-4" strokeWidth={1.6} />
              Download plan (PDF)
            </button>
          </div>
        </section>

        <p className="mt-8 mb-6 border-t border-line pt-4 text-[11px] leading-relaxed text-grey/80">
          Example data: the plan, weeks, hours, cost types, eligibility results, SDG links and last-checked dates on
          this page are illustrative example data (SDC Hackathon demo). Course titles and programme details are
          examples, not verified listings; always confirm on the provider&rsquo;s site.
        </p>
      </main>
      <EstimateFooter />
    </div>
  );
}
