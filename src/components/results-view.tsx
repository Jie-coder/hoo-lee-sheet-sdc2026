// Results (spec §5): the current role's AI exposure, three role tickets, and a
// scenario pill that re-ranks them with a 300ms FLIP. Every number comes from
// POST /api/roles; there is no example data on this page.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useFlow } from "@/context/flow-context";
import { Drawer, IllustrationPanel, PageHero, SignalLight, SourceRow } from "@/components/caldera";
import { EASE_OUT } from "@/components/motion";
import { RoleCard } from "@/components/role-card";
import { ScenarioTabs, SCENARIO_LABEL } from "@/components/scenario-tabs";
import { SignalDateToggle } from "@/components/signal-date-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { SignalDate } from "@/lib/analyze";
import { explainRole } from "@/lib/explain";
import { useT, type MessageKey } from "@/lib/i18n";
import { rankRoles } from "@/lib/rank-roles";
import { useRoles } from "@/lib/use-roles";
import { PERSONAS } from "@/mocks/personas";
import { scoreBand, type RoleResult, type ScenarioId } from "@/types/contracts";

const BAND_LEVEL: Record<"low" | "medium" | "high", MessageKey> = {
  low: "results.exposureLevelLow",
  medium: "results.exposureLevelMedium",
  high: "results.exposureLevelHigh",
};

export function ResultsView() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { t } = useT();
  const { hydrated, consent, profile, interviewAnswers, setChosenRoleId } = useFlow();
  const [signalDate, setSignalDate] = useState<SignalDate>("today");
  const { state, retry } = useRoles(profile, interviewAnswers.impact_interest, signalDate);
  const [scenario, setScenario] = useState<ScenarioId>("co");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!consent) router.replace("/");
    else if (!profile) router.replace("/profile");
  }, [hydrated, consent, profile, router]);

  if (!profile) return null;

  const data = state.status === "ready" ? state.data : null;
  const ranked = data ? rankRoles(data.roles, scenario) : [];
  const persona = profile.personaId === "upload" ? null : PERSONAS[profile.personaId];
  const currentRole = profile.roles[0]?.title || persona?.jobTitle;
  const matchedCount = data?.skillMatches.filter((match) => match.escoLabels.length > 0).length ?? 0;
  // The scenario didn't change the order: say so (spec §5), measured against Co-Pilot.
  const sameAsCo =
    data != null &&
    scenario !== "co" &&
    rankRoles(data.roles, "co")
      .map((role) => role.occupationId)
      .join() === ranked.map((role) => role.occupationId).join();

  function handleChoose(role: RoleResult) {
    setChosenId(role.occupationId);
    setChosenRoleId(role.occupationId);
    router.push(`/pathway?role=${role.occupationId}`);
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-6 md:px-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <PageHero
          className="pt-6 md:pt-10"
          eyebrow={
            profile.name
              ? currentRole
                ? t("results.eyebrow", { name: profile.name, role: currentRole })
                : profile.name
              : currentRole
          }
          title={t("results.heroHeading")}
          lede={
            data
              ? t("results.heroLede", { matched: String(matchedCount), total: String(profile.skills.length) })
              : t("results.matching")
          }
        />
      </motion.div>

      {state.status === "error" && (
        <div className="mt-10 rounded-[40px] bg-card p-7 text-[14px]" role="alert">
          <p className="font-bold">{t("results.rankError")}</p>
          <p className="mt-1 text-grey">{state.message}</p>
          <button type="button" onClick={retry} className="btn-secondary mt-4">
            <RefreshCw className="size-4" strokeWidth={1.6} />
            {t("results.tryAgain")}
          </button>
        </div>
      )}

      {state.status === "loading" && (
        <div className="mt-10 space-y-4 md:mt-16" aria-busy="true" aria-live="polite">
          <Skeleton className="h-[360px] rounded-[40px] bg-alt" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-[420px] rounded-[40px] bg-alt" />
            <Skeleton className="h-[420px] rounded-[40px] bg-alt" />
            <Skeleton className="h-[420px] rounded-[40px] bg-alt" />
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Exposure band */}
          {data.currentWork ? (
            <section className="mt-10 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-[1fr_1.25fr]">
              <div className="flex min-h-[320px] flex-col justify-between rounded-[40px] bg-card p-8 md:min-h-[360px] md:p-10">
                <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
                  {t("results.currentRoleLabel")}
                </p>
                <div>
                  <div className="flex items-center gap-3.5">
                    <SignalLight level={scoreBand(data.currentWork.exposure)} size={22} />
                    <span className="font-serif text-[clamp(40px,9vw,64px)] leading-[0.95] uppercase">
                      {t(BAND_LEVEL[scoreBand(data.currentWork.exposure)])}
                    </span>
                  </div>
                  <p className="mt-3.5 max-w-[460px] text-[16px] leading-relaxed">
                    {t("results.exposureSentence", {
                      percent: `${Math.round(data.currentWork.exposure * 100)}%`,
                      role: data.currentWork.title,
                    })}{" "}
                    {t("scoreCard.notJobLoss")}
                  </p>
                </div>
                <SourceRow sources={data.currentWork.sources.map((source) => ({ label: source.dataset }))} />
              </div>
              <IllustrationPanel
                src="/illustrations/u3.svg"
                panel="plasma"
                className="h-[200px] md:h-auto md:min-h-[360px]"
              />
            </section>
          ) : (
            <section className="mt-10 rounded-[40px] bg-card p-8 md:mt-16 md:p-10">
              <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
                {t("results.currentRoleLabel")}
              </p>
              <div className="mt-4 flex items-center gap-3.5">
                <SignalLight level="pending" size={22} />
                <span className="font-serif text-[clamp(32px,7vw,48px)] leading-[0.95] uppercase">
                  {t("results.exposureLevelPending")}
                </span>
              </div>
              <p className="mt-3.5 max-w-[560px] text-[16px] leading-relaxed text-grey">
                {t("results.exposurePendingBand")}
              </p>
            </section>
          )}

          {/* Tickets header + scenario pill */}
          <section className="mt-24">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="font-serif text-[clamp(40px,8vw,64px)] leading-[0.95] uppercase">
                {t("results.ticketsHeading")}
              </h2>
              <ScenarioTabs value={scenario} onChange={setScenario} />
            </div>
            <p className="mt-3 font-mono text-[12px] tracking-[0.06em] text-grey/70 uppercase" aria-live="polite">
              {sameAsCo
                ? t("results.sameScenarioOrder", { scenario: t(SCENARIO_LABEL.co) })
                : t("results.ticketsSub")}
            </p>

            <LayoutGroup>
              <div className="mt-8 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
                {ranked.map((role, index) => {
                  const breakdown = data.breakdown[role.occupationId];
                  return (
                    <RoleCard
                      key={role.occupationId}
                      role={{ ...role, explanation: explainRole(role, breakdown, scenario, t) }}
                      rank={index + 1}
                      total={ranked.length}
                      targetLabels={data.targetLabels}
                      chosen={chosenId === role.occupationId}
                      onChoose={handleChoose}
                      isPrimary={index === 0}
                    />
                  );
                })}
              </div>
            </LayoutGroup>

            <SourceRow
              className="mt-10"
              sources={[{ label: "WEF 2025" }, { label: "JobStreet" }, { label: "arXiv signal" }]}
              howOnClick={() => setHowOpen(true)}
            />
          </section>

          <Drawer open={howOpen} onClose={() => setHowOpen(false)} title={t("results.howNumbers")}>
            {data.signalDates.prior && (
              <div className="mb-6">
                <SignalDateToggle value={data.signalDate} dates={data.signalDates} onChange={setSignalDate} />
              </div>
            )}
            <p className="text-[15px] leading-relaxed text-grey">{t("results.howNumbersBody")}</p>
          </Drawer>
        </>
      )}
    </main>
  );
}
