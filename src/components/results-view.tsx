// Results screen: roles ranked from the curated data by POST /api/roles,
// re-ranked by scenario on the client. No example data on this page.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup } from "framer-motion";
import { Hand, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useFlow } from "@/context/flow-context";
import { EstimateFooter } from "@/components/estimate-footer";
import { RoleCard } from "@/components/role-card";
import {
  ScenarioTabs,
  SCENARIO_ILLUSTRATIVE,
  SCENARIO_LABEL,
  SCENARIO_SUMMARY,
} from "@/components/scenario-tabs";
import { ScoreCard } from "@/components/score-card";
import { sdgFlagId } from "@/components/sdg-badge";
import { SdgLegend } from "@/components/sdg-legend";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoPopover } from "@/components/ui/info-popover";
import { SignalDateToggle } from "@/components/signal-date-toggle";
import type { SignalDate } from "@/lib/analyze";
import { describeChange, rankChanges } from "@/lib/compare-snapshots";
import { formatDayMonthYear } from "@/lib/display";
import { explainRole } from "@/lib/explain";
import { rankRoles } from "@/lib/rank-roles";
import { useRoles } from "@/lib/use-roles";
import { PERSONAS } from "@/mocks/personas";
import type { RoleResult, ScenarioId, SdgLink } from "@/types/contracts";

export function ResultsView() {
  const router = useRouter();
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
  const chosen = ranked.find((role) => role.occupationId === chosenId) ?? null;
  const changes =
    todayRoles.status === "ready" && priorRoles.status === "ready" && todayRoles.data.signalDates.prior
      ? rankChanges(priorRoles.data.roles, todayRoles.data.roles, scenario)
      : null;
  const persona = profile.personaId === "upload" ? null : PERSONAS[profile.personaId];
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
    toast(`Flagged target ${link.target} for a person to review.`);
  }

  return (
    <div className="bg-paper pb-32 text-ink sm:pb-16">
      <div className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <section className="flex flex-col gap-3 pt-7 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] text-grey">
              {[profile.name || "Your profile", persona ? `${persona.age}` : null, persona?.jobTitle, persona?.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-medium tracking-tight sm:text-[36px]">
              Where your skills can take you next
            </h1>
          </div>
          <p className="max-w-[420px] text-[13px] leading-relaxed text-grey sm:text-right">
            {data
              ? `${matchedCount} of ${profile.skills.length} of your skills matched to ESCO. Ranked with ILO exposure and arXiv trend counts checked ${formatDayMonthYear(data.signalsAsOf)}.`
              : "Matching your skills to ESCO and ranking roles…"}
          </p>
        </section>

        {state.status === "error" && (
          <div className="rounded-2xl border border-line bg-white p-6 text-[14px]" role="alert">
            <p className="font-medium">We couldn&rsquo;t rank roles right now.</p>
            <p className="mt-1 text-grey">{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-btn2 px-4 py-2 text-[14px] font-medium"
            >
              <RefreshCw className="size-4" strokeWidth={1.6} />
              Try again
            </button>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-5" aria-busy="true" aria-live="polite">
            <Skeleton className="h-48 rounded-2xl bg-alt" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Skeleton className="h-96 rounded-2xl bg-alt" />
              <Skeleton className="h-96 rounded-2xl bg-alt" />
              <Skeleton className="h-96 rounded-2xl bg-alt" />
            </div>
          </div>
        )}

        {data && (
          <>
            {data.currentWork ? (
              <ScoreCard currentWork={data.currentWork} />
            ) : (
              <p className="rounded-2xl border border-line bg-white p-5 text-[14px] text-grey">
                We can&rsquo;t show the AI exposure of your current job yet: it isn&rsquo;t one of the 40 jobs in our
                list. The roles below are still ranked from your skills.
              </p>
            )}

            <section className="mt-12 flex flex-col gap-4 rounded-2xl border border-line bg-white px-4 py-3 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <ScenarioTabs value={scenario} onChange={setScenario} />
                <InfoPopover label={`About the ${SCENARIO_LABEL[scenario]} scenario`}>
                  <span className="font-medium text-ink">{SCENARIO_LABEL[scenario]}:</span> {SCENARIO_SUMMARY[scenario]}{" "}
                  <span className="text-grey/80">{SCENARIO_ILLUSTRATIVE}</span>
                </InfoPopover>
              </div>
              <SignalDateToggle value={data.signalDate} dates={data.signalDates} onChange={setSignalDate} />
            </section>
            {changes && data.signalDates.prior && (
              <p className="mt-3 text-[13px] leading-relaxed text-grey" aria-live="polite">
                <span className="font-medium text-ink">
                  What changed from {formatDayMonthYear(data.signalDates.prior)} to{" "}
                  {formatDayMonthYear(data.signalDates.today)} ({SCENARIO_LABEL[scenario]}):
                </span>{" "}
                {changes.length > 0
                  ? `${changes.slice(0, 3).map(describeChange).join("; ")}.`
                  : "no role changed rank. The new arXiv counts nudged the scores, but not the order."}
              </p>
            )}

            <section className="mt-12">
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <h2 className="font-serif text-[24px] font-medium tracking-tight">
                  {ranked.length} roles you could move into
                </h2>
                <SdgLegend />
              </div>

              <LayoutGroup>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {ranked.map((role, index) => {
                    const breakdown = data.breakdown[role.occupationId];
                    return (
                      <RoleCard
                        key={role.occupationId}
                        role={{ ...role, explanation: explainRole(role, breakdown, scenario) }}
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

              <p className="mt-4 flex items-start gap-2 text-[13px] text-grey">
                <Hand className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
                {chosen
                  ? `You chose ${chosen.title}. Your reskilling pathway is built next, with courses in your chosen language.`
                  : "You choose the role. Your reskilling pathway is built next, with courses in your chosen language."}
              </p>
            </section>

            <p className="mt-8 mb-6 border-t border-line pt-4 text-[11px] leading-relaxed text-grey/80">
              How these numbers are made: skills come from ESCO v1.2.1, AI exposure from the ILO GenAI exposure study
              (2025), and the trend signal from arXiv paper counts. Demand under each future is an illustrative
              assumption from the SDC brief, not a forecast. SDG targets are drafted by the Laluan team and still
              under review. Your CV skills were matched to ESCO by hand for these synthetic sample profiles. These are
              estimates to support your decision, not predictions.
            </p>
          </>
        )}
      </div>
      <EstimateFooter />
    </div>
  );
}
