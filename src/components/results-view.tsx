// Results screen: scenario re-rank, signal-date swap, and a mock refresh.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup } from "framer-motion";
import { Hand } from "lucide-react";
import { toast } from "sonner";
import { useFlow } from "@/context/flow-context";
import { EstimateFooter } from "@/components/estimate-footer";
import { RefreshButton } from "@/components/refresh-button";
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
import { SignalDateToggle, type SignalDate } from "@/components/signal-date-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoPopover } from "@/components/ui/info-popover";
import { formatDayMonthYear } from "@/lib/display";
import { rankRoles } from "@/lib/rank-roles";
import { AISYAH_RESULTS, EXAMPLE_AS_OF, fetchAisyahResults, type ResultsExample } from "@/mocks/aisyah";
import type { RoleResult, ScenarioId, SdgLink } from "@/types/contracts";

export function ResultsView({ initial }: { initial: ResultsExample }) {
  const router = useRouter();
  const { hydrated, consent, setChosenRoleId } = useFlow();
  const [signal, setSignal] = useState<SignalDate>("today");
  const [scenario, setScenario] = useState<ScenarioId>("co");
  const [snapshot, setSnapshot] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [refreshedOn, setRefreshedOn] = useState(EXAMPLE_AS_OF);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (hydrated && !consent) router.replace("/");
  }, [hydrated, consent, router]);

  const ranked = rankRoles(snapshot.response.roles, scenario);
  const chosen = ranked.find((role) => role.occupationId === chosenId) ?? null;

  function handleSignal(next: SignalDate) {
    if (next === signal || loading) return;
    setSignal(next);
    setSnapshot(AISYAH_RESULTS[next]);
  }

  async function handleRefresh() {
    setLoading(true);
    try {
      const next = await fetchAisyahResults(signal);
      setSnapshot(next);
      setRefreshedOn(EXAMPLE_AS_OF);
      toast.success("Example results refreshed.");
    } catch {
      toast.error("Could not refresh the example results.");
    } finally {
      setLoading(false);
    }
  }

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
            <p className="text-[13px] text-grey">{snapshot.persona.detail}</p>
            <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-medium tracking-tight sm:text-[36px]">
              {snapshot.persona.headline}
            </h1>
          </div>
          <p className="max-w-[380px] text-[13px] leading-relaxed text-grey sm:text-right">
            {snapshot.persona.basis}
          </p>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12" aria-busy="true" aria-live="polite">
            <Skeleton className="h-64 rounded-2xl bg-alt lg:col-span-7" />
            <Skeleton className="h-64 rounded-2xl bg-alt lg:col-span-5" />
          </div>
        ) : (
          <ScoreCard currentWork={snapshot.response.currentWork} tasks={snapshot.tasks} />
        )}

        <section className="mt-12 flex flex-col gap-4 rounded-2xl border border-line bg-white px-4 py-3 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <ScenarioTabs value={scenario} onChange={setScenario} />
            <InfoPopover label={`About the ${SCENARIO_LABEL[scenario]} scenario`}>
              <span className="font-medium text-ink">{SCENARIO_LABEL[scenario]}:</span> {SCENARIO_SUMMARY[scenario]}{" "}
              <span className="text-grey/80">{SCENARIO_ILLUSTRATIVE}</span>
            </InfoPopover>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <SignalDateToggle value={signal} onChange={handleSignal} disabled={loading} />
            <span className="text-[12px] whitespace-nowrap text-grey">Refreshed {formatDayMonthYear(refreshedOn)}</span>
            <RefreshButton loading={loading} onRefresh={handleRefresh} />
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="font-serif text-[24px] font-medium tracking-tight">Three roles you could move into</h2>
            <SdgLegend />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3" aria-busy="true">
              <Skeleton className="h-96 rounded-2xl bg-alt" />
              <Skeleton className="h-96 rounded-2xl bg-alt" />
              <Skeleton className="h-96 rounded-2xl bg-alt" />
            </div>
          ) : (
            <LayoutGroup>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {ranked.map((role, index) => (
                  <RoleCard
                    key={role.occupationId}
                    role={role}
                    rank={index + 1}
                    total={ranked.length}
                    status={snapshot.roleStatus[role.occupationId] ?? { label: "Possible move", tone: "shift" }}
                    skillLinks={snapshot.skillLinks}
                    targetLabels={snapshot.targetLabels}
                    chosen={chosenId === role.occupationId}
                    onChoose={handleChoose}
                    flaggedIds={flaggedIds}
                    onFlag={handleFlag}
                  />
                ))}
              </div>
            </LayoutGroup>
          )}

          <p className="mt-4 flex items-start gap-2 text-[13px] text-grey">
            <Hand className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
            {chosen
              ? `You chose ${chosen.title}. Your reskilling pathway is built next, with courses in your chosen language.`
              : "You choose the role. Your reskilling pathway is built next, with courses in your chosen language."}
          </p>
        </section>

        <p className="mt-8 mb-6 border-t border-line pt-4 text-[11px] leading-relaxed text-grey/80">
          Example data: all names, scores, fit percentages, scenario values, SDG links and source dates on this
          page are illustrative example data for the synthetic persona Aisyah (SDC Hackathon demo). They are not
          real measurements.
        </p>
      </div>
      <EstimateFooter />
    </div>
  );
}
