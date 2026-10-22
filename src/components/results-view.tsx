// Results screen: roles ranked from the curated data by POST /api/roles,
// re-ranked by scenario on the client. No example data on this page.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useFlow } from "@/context/flow-context";
import { EstimateFooter } from "@/components/estimate-footer";
import { EASE_OUT } from "@/components/motion";
import { RoleCard } from "@/components/role-card";
import { ScenarioTabs, SCENARIO_ILLUSTRATIVE, SCENARIO_LABEL, SCENARIO_SUMMARY } from "@/components/scenario-tabs";
import { ExposurePendingCard, ScoreCard } from "@/components/score-card";
import { sdgFlagId } from "@/components/sdg-badge";
import { SdgLegend } from "@/components/sdg-legend";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoPopover } from "@/components/ui/info-popover";
import { SignalDateToggle } from "@/components/signal-date-toggle";
import type { SignalDate } from "@/lib/analyze";
import { describeChangeShort, rankChanges } from "@/lib/compare-snapshots";
import { formatDayMonthYear, formatShortDate } from "@/lib/display";
import { explainRole } from "@/lib/explain";
import { useT } from "@/lib/i18n";
import { rankRoles } from "@/lib/rank-roles";
import { useRoles } from "@/lib/use-roles";
import { PERSONAS } from "@/mocks/personas";
import type { RoleResult, ScenarioId, SdgLink } from "@/types/contracts";

export function ResultsView() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { t } = useT();
  const { hydrated, consent, profile, interviewAnswers, setChosenRoleId } = useFlow();
  const [signalDate, setSignalDate] = useState<SignalDate>("today");
  const { state, retry } = useRoles(profile, interviewAnswers.impact_interest, signalDate);
  // Both snapshots, so the page can say what moved between them (cached per request).
  const todayRoles = useRoles(profile, interviewAnswers.impact_interest, "today").state;
  const priorRoles = useRoles(profile, interviewAnswers.impact_interest, "prior").state;
  const [scenario, setScenario] = useState<ScenarioId>("co");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!hydrated) return;
    if (!consent) router.replace("/");
    else if (!profile) router.replace("/profile");
  }, [hydrated, consent, profile, router]);

  if (!profile) return null;

  const data = state.status === "ready" ? state.data : null;
  const ranked = data ? rankRoles(data.roles, scenario) : [];
  const changes =
    todayRoles.status === "ready" && priorRoles.status === "ready" && todayRoles.data.signalDates.prior
      ? rankChanges(priorRoles.data.roles, todayRoles.data.roles, scenario)
      : null;
  const persona = profile.personaId === "upload" ? null : PERSONAS[profile.personaId];
  const firstName = profile.name?.trim().split(/\s+/)[0];
  const matchedCount = data?.skillMatches.filter((match) => match.escoLabels.length > 0).length ?? 0;

  function handleChoose(role: RoleResult) {
    setChosenId(role.occupationId);
    setChosenRoleId(role.occupationId);
    router.push(`/pathway?role=${role.occupationId}`);
  }

  function handleFlag(link: SdgLink) {
    const id = sdgFlagId(link);
    setFlaggedIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
    toast(t("results.flagToast", { target: link.target }));
  }

  return (
    <div className="pb-16 sm:pb-20">
      <div className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="pt-10 pb-8"
        >
          <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">
            {firstName ? t("results.headingNamed", { name: firstName }) : t("results.heading")}
          </h1>
          {(profile.roles[0]?.title || persona?.jobTitle) && (
            <p className="mt-2 text-[14px] text-grey">{profile.roles[0]?.title || persona?.jobTitle}</p>
          )}
          <p className="mt-2 text-[15px] text-grey">
            {data
              ? t("results.skillsMatchedLine", {
                  matched: String(matchedCount),
                  total: String(profile.skills.length),
                  date: formatDayMonthYear(data.signalsAsOf, t),
                })
              : t("results.matching")}
          </p>
        </motion.section>

        {state.status === "error" && (
          <div className="panel p-6 text-[14px]" role="alert">
            <p className="font-medium">{t("results.rankError")}</p>
            <p className="mt-1 text-grey">{state.message}</p>
            <button type="button" onClick={retry} className="btn-secondary mt-4">
              <RefreshCw className="size-4" strokeWidth={1.6} />
              {t("results.tryAgain")}
            </button>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-6" aria-busy="true" aria-live="polite">
            <Skeleton className="h-40 rounded-3xl bg-alt" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Skeleton className="h-96 rounded-3xl bg-alt" />
              <Skeleton className="h-96 rounded-3xl bg-alt" />
              <Skeleton className="h-96 rounded-3xl bg-alt" />
            </div>
          </div>
        )}

        {data && (
          <>
            {data.currentWork ? (
              <>
                <ScoreCard currentWork={data.currentWork} />
                <p className="mt-3 text-[13px] text-grey">{t("scoreCard.notJobLoss")}</p>
              </>
            ) : (
              <ExposurePendingCard />
            )}

            <section className="mt-12">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="font-serif text-[28px] font-medium tracking-tight">
                  {t("results.roleCount", { count: String(ranked.length) })}
                </h2>
                <div className="flex items-center gap-2">
                  <ScenarioTabs value={scenario} onChange={setScenario} />
                  <InfoPopover
                    label={t("results.aboutScenario", { scenario: t(SCENARIO_LABEL[scenario]) })}
                    align="end"
                    side="top"
                  >
                    <span className="font-medium text-ink">{t(SCENARIO_LABEL[scenario])}:</span>{" "}
                    {t(SCENARIO_SUMMARY[scenario])} <span className="text-grey/80">{t(SCENARIO_ILLUSTRATIVE)}</span>
                  </InfoPopover>
                </div>
              </div>

              {data.signalDates.prior && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13px] text-grey" aria-live="polite">
                    {changes && changes.length > 0 ? (
                      <>
                        <span className="text-ink">{t("results.since", { date: formatShortDate(data.signalDates.prior, t) })}</span>{" "}
                        {changes.slice(0, 3).map((change) => describeChangeShort(change, t)).join(" · ")}
                      </>
                    ) : (
                      <>{t("results.sameOrder", { date: formatShortDate(data.signalDates.prior, t) })}</>
                    )}{" "}
                    <Link href="/radar" className="whitespace-nowrap text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                      {t("results.skillsRadar")}
                    </Link>
                  </p>
                  <SignalDateToggle value={data.signalDate} dates={data.signalDates} onChange={setSignalDate} />
                </div>
              )}

              <LayoutGroup>
                <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
                  {ranked.map((role, index) => {
                    const breakdown = data.breakdown[role.occupationId];
                    return (
                      <RoleCard
                        key={role.occupationId}
                        role={{ ...role, explanation: explainRole(role, breakdown, scenario, t) }}
                        rank={index + 1}
                        total={ranked.length}
                        status={breakdown.status}
                        skillLinks={[]}
                        targetLabels={data.targetLabels}
                        chosen={chosenId === role.occupationId}
                        onChoose={handleChoose}
                        flaggedIds={flaggedIds}
                        onFlag={handleFlag}
                      />
                    );
                  })}
                </div>
              </LayoutGroup>

              <div className="mt-6 flex flex-col gap-3 text-[12px] text-grey sm:flex-row sm:items-center sm:justify-between">
                <SdgLegend />
                <div className="flex items-center gap-1">
                  {t("results.howNumbers")}
                  <InfoPopover label={t("results.howNumbers")} align="end" side="top">
                    {t("results.howNumbersBody")}
                  </InfoPopover>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
      <EstimateFooter />
    </div>
  );
}
