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
import { Disclosure } from "@/components/ui/disclosure";
import { InfoPopover } from "@/components/ui/info-popover";
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">DURATION</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight whitespace-nowrap md:text-[36px]">
                {totalWeeks} weeks
              </p>
              <p className="mt-1.5 text-[12px] text-grey">{plan.steps.length} steps</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">PACE</p>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight whitespace-nowrap md:text-[36px]">
                {hoursPerWeek} h <span className="text-[20px] text-grey/50 md:text-[24px]">/ week</span>
              </p>
              <p className="mt-1.5 text-[12px] text-grey">Never over {hoursPerWeek} h a week</p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">COST</p>
                <InfoPopover label="Cost types, in plan order">
                  <span className="mr-1">Cost types, in plan order:</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.keys(COST_LABEL) as CostType[]).map((type) => {
                      const Icon = COST_ICON[type];
                      return (
                        <span key={type} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px]", COST_CLASS[type])}>
                          <Icon className="size-3" strokeWidth={1.6} />
                          {COST_LABEL[type]}
                        </span>
                      );
                    })}
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-[11px] text-grey">
                    <CalendarCheck className="size-3" strokeWidth={1.6} />
                    Laluan curated catalogue
                  </span>
                </InfoPopover>
              </div>
              <p className="mt-2 font-serif text-[28px] leading-none font-medium tracking-tight whitespace-nowrap md:text-[36px]">
                <span className={mostlyFree ? "text-sage" : undefined}>{mostlyFree ? "Mostly free" : "Mixed cost"}</span>
              </p>
              <p className="mt-1.5 text-[12px] text-grey">
                {(Object.entries(costCounts) as [CostType, number][])
                  .map(([type, count]) => `${count} ${COST_LABEL[type].toLowerCase()}`)
                  .join(" · ")}
              </p>
            </div>
            <div>
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
        </section>

        <section className="mt-12 grid grid-cols-1 items-start gap-5 md:grid-cols-12">
          {/* Timeline */}
          <div className="md:col-span-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif text-[24px] font-medium tracking-tight">Week by week</h2>
                <InfoPopover label="How this plan was built">
                  How this plan was built: only items in your languages that fit {hoursPerWeek} h a week, ordered
                  free first, prerequisites first. Full notes in the side panel.
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
            <ol className="space-y-4">
              {plan.steps.map((step, index) => {
                const item = resolveItem(step);
                if (!item) return null;
                const sdgLink = step.sdgTarget ? role.sdg.find((link) => link.target === step.sdgTarget) : undefined;
                const closedSkill = role.gap.find((skill) => step.closesSkillIds.includes(skill.skillId));
                const providerName = "provider" in item ? item.provider : item.agency;
                const weeksLabel =
                  step.weekStart === step.weekEnd ? `Week ${step.weekStart}` : `Weeks ${step.weekStart}–${step.weekEnd}`;
                const eligibility = step.kind === "program" ? programmeEligibilityStatus(item as Programme, interviewAnswers) : null;
                return (
                  <li key={step.itemId} className="grid grid-cols-[32px_1fr] gap-x-4">
                    <div className="flex justify-center">
                      <span className="flex size-8 items-center justify-center rounded-full border border-sage bg-white text-[13px] font-medium tabular-nums">
                        {index + 1}
                      </span>
                    </div>
                    <article className="rounded-2xl border border-line bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-grey">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1.5">
                            {step.kind === "course" ? (
                              <GraduationCap className="size-3.5" strokeWidth={1.6} />
                            ) : (
                              <Landmark className="size-3.5" strokeWidth={1.6} />
                            )}
                            {providerName}
                          </span>
                          {eligibility === "check" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-ink/70 px-2 py-0.5 text-[11px] font-medium text-ink">
                              <CircleHelp className="size-3" strokeWidth={1.6} />
                              Check eligibility
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums">{weeksLabel}</span>
                      </div>
                      <h3 className="mt-2 font-serif text-[22px] leading-tight font-medium">
                        {"title" in item ? item.title : item.name}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px]", COST_CLASS[item.costType])}>
                          {(() => {
                            const Icon = COST_ICON[item.costType];
                            return <Icon className="size-3" strokeWidth={1.6} />;
                          })()}
                          {COST_LABEL[item.costType]}
                        </span>
                        <span className="flex items-center gap-1 text-grey">
                          <Clock3 className="size-3.5" strokeWidth={1.6} />
                          {"hours" in item ? (
                            `${item.hours} h`
                          ) : (
                            <span aria-label="Hours not listed">— h</span>
                          )}
                        </span>
                        {closedSkill && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Target className="size-3.5 shrink-0 text-sage" strokeWidth={1.6} />
                            <span className="text-grey">Closes</span>{" "}
                            <span className="font-medium">{closedSkill.label}</span>
                          </span>
                        )}
                      </div>

                      <Disclosure
                        className="mt-4"
                        summary={<span className="text-[13px] text-grey">Details</span>}
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
                        {eligibility === "fail" && (
                          <p className="text-[12px] text-grey">Not eligible based on your answers.</p>
                        )}
                        {eligibility === "check" && (
                          <div className="flex items-start gap-2 rounded-lg border border-ink/70 bg-paper px-3 py-2.5 text-[12px] leading-relaxed">
                            <CircleHelp className="mt-px size-4 shrink-0" strokeWidth={1.6} />
                            <div>
                              <p className="text-[13px] font-medium">Check eligibility</p>
                              <p className="text-grey">We don&rsquo;t know yet whether you meet every rule for this programme.</p>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-grey">
                          <span>{step.kind === "course" ? "Course" : "Government programme"}</span>
                          {"languages" in item && (
                            <span className="flex items-center gap-1">
                              <Languages className="size-3.5" strokeWidth={1.6} />
                              Languages: {item.languages.map((language) => LANGUAGE_LABEL[language] ?? language).join(" · ")}
                            </span>
                          )}
                          {"certificate" in item && (
                            <span className="flex items-center gap-1">
                              {item.certificate ? (
                                <Award className="size-3.5" strokeWidth={1.6} />
                              ) : (
                                <CircleSlash className="size-3.5" strokeWidth={1.6} />
                              )}
                              {item.certificate ? "Certificate" : "No certificate"}
                            </span>
                          )}
                          {sdgLink && (
                            <span className="flex items-center gap-1.5">
                              SDG <SdgBadge link={sdgLink} label={AISYAH_RESULTS.today.targetLabels[sdgLink.target] ?? sdgLink.target} />
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
                            className="flex items-center gap-1 text-[12px] text-grey underline underline-offset-4"
                          >
                            Open source
                            <ArrowUpRight className="size-3" strokeWidth={1.6} />
                          </a>
                        </div>
                      </Disclosure>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Side panel: each box collapses to a one-line summary. */}
          <aside className="space-y-4 md:col-span-4">
            <div className="rounded-2xl border border-line bg-white p-6">
              <Disclosure
                summaryClassName="text-[11px] font-semibold tracking-[0.12em] text-grey"
                summary={
                  <span className="flex items-center justify-between gap-2">
                    YOUR SKILL GAP
                    <span className="font-serif text-[20px] font-medium tracking-normal text-ink">
                      {closedSkillIds.size} <span className="text-[14px] font-sans font-normal text-grey">of {role.gap.length} covered</span>
                    </span>
                  </span>
                }
                contentClassName="mt-4"
              >
                <p className="mb-2 text-[12px] text-grey">
                  The top {role.gap.length} skills from your role card, and the step that closes each one.
                </p>
                <ul className="space-y-2 text-[13px]">
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
              </Disclosure>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
              <Disclosure
                summaryClassName="text-[11px] font-semibold tracking-[0.12em] text-grey"
                summary={
                  <span className="flex items-center gap-2">
                    SDG TARGETS
                    <span className="flex items-center gap-1.5">
                      <SdgBadge
                        link={role.sdg[0]}
                        label={AISYAH_RESULTS.today.targetLabels[role.sdg[0].target] ?? role.sdg[0].target}
                        plain
                      />
                      {role.sdg.length > 1 && (
                        <span className="rounded-md bg-alt px-1.5 py-0.5 text-[12px] font-normal text-grey">
                          +{role.sdg.length - 1}
                        </span>
                      )}
                    </span>
                  </span>
                }
                contentClassName="mt-4"
              >
                <div className="flex flex-wrap gap-1.5 text-[12px]">
                  {role.sdg.map((link) => (
                    <SdgBadge key={link.target} link={link} label={AISYAH_RESULTS.today.targetLabels[link.target] ?? link.target} />
                  ))}
                </div>
                <div className="mt-3">
                  <SdgLegend />
                </div>
              </Disclosure>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
              <Disclosure
                summaryClassName="text-[11px] font-semibold tracking-[0.12em] text-grey"
                summary={<span>HOW THIS PLAN WAS BUILT</span>}
                contentClassName="mt-3"
              >
                <p className="mb-3 text-[13px] text-grey">
                  Your languages ({studyLanguages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")}), {hoursPerWeek} h a
                  week, free first. Links from our checked catalogue only.
                </p>
                <ul className="space-y-2.5 text-[13px] leading-relaxed text-grey">
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
                  <p className="mt-4 flex items-center gap-1.5 text-[12px] text-grey">
                    <ShieldCheck className="size-3.5 text-sage" strokeWidth={1.6} />
                    Role is robust in all 3 futures (Results, {formatDayMonthYear(role.signalsAsOf)})
                  </p>
                )}
              </Disclosure>
            </div>
          </aside>
        </section>

        <section className="mt-12 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
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
