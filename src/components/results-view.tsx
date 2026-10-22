// Results screen: roles ranked from the curated data by POST /api/roles,
// re-ranked by scenario on the client. No example data on this page.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useFlow } from "@/context/flow-context";
import { EstimateFooter } from "@/components/estimate-footer";
import { EASE_OUT } from "@/components/motion";
import { RoleCard } from "@/components/role-card";
import { ScenarioTabs, SCENARIO_ILLUSTRATIVE, SCENARIO_LABEL, SCENARIO_SUMMARY } from "@/components/scenario-tabs";
import { ScoreCard } from "@/components/score-card";
import { sdgFlagId } from "@/components/sdg-badge";
import { SdgLegend } from "@/components/sdg-legend";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoPopover } from "@/components/ui/info-popover";
import { formatDayMonthYear } from "@/lib/display";
import { explainRole } from "@/lib/explain";
import { rankRoles } from "@/lib/rank-roles";
import { useRoles } from "@/lib/use-roles";
import { PERSONAS } from "@/mocks/personas";
import type { RoleResult, ScenarioId, SdgLink } from "@/types/contracts";

export function ResultsView() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { hydrated, consent, profile, interviewAnswers, setChosenRoleId } = useFlow();
  const { state, retry } = useRoles(profile, interviewAnswers.impact_interest);
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
    <div className="pb-32 sm:pb-20">
      <div className="mx-auto max-w-[1248px] px-4 sm:px-6">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="pt-10 pb-8"
        >
          <p className="text-[13px] text-grey">
            {[profile.name || "Your profile", persona?.jobTitle, persona?.location].filter(Boolean).join(", ")}
          </p>
          <h1 className="mt-1 font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">
            Where your skills can take you
          </h1>
          <p className="mt-2 text-[15px] text-grey">
            {data
              ? `${matchedCount} of ${profile.skills.length} skills matched. Signal checked ${formatDayMonthYear(data.signalsAsOf)}.`
              : "Matching your skills and ranking roles…"}
          </p>
        </motion.section>

        {state.status === "error" && (
          <div className="panel p-6 text-[14px]" role="alert">
            <p className="font-medium">We couldn&rsquo;t rank roles right now.</p>
            <p className="mt-1 text-grey">{state.message}</p>
            <button type="button" onClick={retry} className="btn-secondary mt-4">
              <RefreshCw className="size-4" strokeWidth={1.6} />
              Try again
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
              <ScoreCard currentWork={data.currentWork} />
            ) : (
              <p className="border-y border-line py-6 text-[14px] text-grey">
                Your current job isn&rsquo;t one of the 40 in our list, so its AI exposure isn&rsquo;t shown. The roles
                below are still ranked from your skills.
              </p>
            )}

            <section className="mt-12">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="font-serif text-[28px] font-medium tracking-tight">{ranked.length} roles you could move into</h2>
                <div className="flex items-center gap-2">
                  <ScenarioTabs value={scenario} onChange={setScenario} />
                  <InfoPopover label={`About the ${SCENARIO_LABEL[scenario]} scenario`} panelClassName="right-0 left-auto">
                    <span className="font-medium text-ink">{SCENARIO_LABEL[scenario]}:</span> {SCENARIO_SUMMARY[scenario]}{" "}
                    <span className="text-grey/80">{SCENARIO_ILLUSTRATIVE}</span>
                  </InfoPopover>
                </div>
              </div>

              <LayoutGroup>
                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
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

              <div className="mt-6 flex flex-col gap-3 text-[12px] text-grey sm:flex-row sm:items-center sm:justify-between">
                <SdgLegend />
                <div className="flex items-center gap-1">
                  How these numbers are made
                  <InfoPopover label="How these numbers are made" panelClassName="right-0 bottom-6 left-auto sm:top-auto">
                    Skills come from ESCO v1.2.1, AI exposure from the ILO GenAI exposure study (2025), and the trend
                    signal from arXiv paper counts. Demand under each future is an illustrative assumption from the SDC
                    brief, not a forecast. SDG targets are drafted by the Laluan team and still under review. These are
                    estimates to support your decision, not predictions.
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
