// Landing: hero, how-it-works strip, privacy/consent gate, and dated sources.
// Consent must be ticked before "Start" continues to /profile.
"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  LockKeyhole,
  MessagesSquare,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  Timer,
  Trash2,
  UserRound,
  UserX,
} from "lucide-react";
import { SdgBadge } from "@/components/sdg-badge";
import { SourceChip } from "@/components/source-chip";
import { formatBandScoreParts, formatDayMonthYear, formatFitPercent } from "@/lib/display";
import { useFlow } from "@/context/flow-context";
import type { LandingPreview } from "@/lib/landing-preview";

/** Shortened so the band and score always fit on one line in the preview card. */
const SHORT_BAND: Record<"Low" | "Medium" | "High", string> = { Low: "Low", Medium: "Med", High: "High" };

const HOW_IT_WORKS = [
  {
    icon: UserRound,
    step: "Step 1",
    title: "Profile",
    body: "Pick a sample CV. We read your roles, tasks and skills, and you can edit them.",
    time: "About 1 min",
  },
  {
    icon: MessagesSquare,
    step: "Step 2",
    title: "Interview",
    body: "Five quick questions with tap-to-answer chips, only about what the CV can't tell us.",
    time: "About 2 min",
  },
  {
    icon: Gauge,
    step: "Step 3",
    title: "Results",
    body: "AI exposure and augmentation from dated public data, and three roles ranked under three possible futures.",
    time: "Scores + 3 roles",
  },
  {
    icon: RouteIcon,
    step: "Step 4",
    title: "Pathway",
    body: "You pick a role. We build a week-by-week plan from free courses and government programmes.",
    time: "Free items first",
  },
] as const;

const BUILT_ON = [
  "ESCO v1.2.1 · skills per job",
  "ILO GenAI Exposure · May 2025",
  "arXiv paper counts · 90-day windows",
  "HRD Corp e-LATiH, Coursera and 10 more course providers",
  "Scenario demand · illustrative (SDC brief)",
];

export function LandingView({ preview }: { preview: LandingPreview }) {
  const router = useRouter();
  const { consent, setConsent } = useFlow();
  const consentRef = useRef<HTMLDivElement>(null);

  const previewRole = preview.role;
  const exposure = formatBandScoreParts(preview.currentExposure);
  const roleExposure = formatBandScoreParts(previewRole.exposure);

  function handleHeroStart() {
    if (consent) {
      router.push("/profile");
      return;
    }
    consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleConsentStart() {
    if (!consent) return;
    router.push("/profile");
  }

  return (
    <main className="mx-auto max-w-[1248px] px-4 sm:px-6">
      {/* 1. Hero */}
      <section className="grid grid-cols-1 items-center gap-8 pt-10 pb-10 md:grid-cols-12 md:gap-10 md:pt-16">
        <div className="md:col-span-7">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">FOR MALAYSIAN WORKERS · FREE · NO LOGIN</p>
          <h1 className="mt-3 font-serif text-[40px] leading-[1.05] font-medium tracking-tight md:text-[56px]">
            See how AI changes your work <span className="text-grey/50">—</span> and the free path forward
          </h1>
          <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-grey">
            Laluan reads a CV, asks five quick questions, and shows which of your tasks AI can amplify. Then you
            choose a future role and get a week-by-week plan built from free courses and government programmes.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleHeroStart}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-[15px] font-medium text-white"
            >
              Start
              <ArrowRight className="size-4" strokeWidth={1.6} />
            </button>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-btn2 px-4 py-3 text-[14px] font-medium"
            >
              How it works
            </a>
            <span className="flex items-center gap-1.5 text-[13px] text-grey">
              <Timer className="size-4" strokeWidth={1.6} />
              Takes about 3 minutes
            </span>
          </div>
        </div>

        {/* example result preview */}
        <div className="md:col-span-5">
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">WHAT YOU GET</p>
              <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-grey">Sample profile: {preview.personaName.split(" ")[0]}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-5">
              <div>
                <p className="text-[12px] text-grey">AI exposure today</p>
                <p className="mt-1.5 font-serif text-[36px] leading-none font-medium tracking-tight text-nowrap">
                  {SHORT_BAND[exposure.band]} <span className="text-grey/40">·</span> {exposure.value}
                </p>
                <p className="mt-1 text-[12px] text-grey capitalize">{preview.currentTitle}</p>
              </div>
              <div className="border-l border-line pl-5">
                <p className="text-[12px] text-grey">AI exposure after the move</p>
                <p className="mt-1.5 font-serif text-[36px] leading-none font-medium tracking-tight text-nowrap text-sage">
                  {SHORT_BAND[roleExposure.band]} <span className="text-sage-tint">·</span> {roleExposure.value}
                </p>
                <p className="mt-1 text-[12px] text-grey capitalize">{previewRole.title}</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-medium text-ink">Exposure is not job loss.</p>
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <span
                  className={
                    preview.robust
                      ? "inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-medium text-sage-dark"
                      : "inline-flex items-center gap-1.5 rounded-full bg-alt px-2.5 py-1 text-[12px] text-grey"
                  }
                >
                  <ShieldCheck className="size-3.5" strokeWidth={1.6} />
                  {preview.statusLabel}
                </span>
                <span className="text-[12px] text-grey">{formatFitPercent(previewRole.fit)} fit</span>
              </div>
              <p className="mt-3 font-serif text-[22px] leading-tight font-medium capitalize">{previewRole.title}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[12px]">
                {previewRole.sdg.map((link) => (
                  <SdgBadge
                    key={link.target}
                    link={link}
                    label={preview.targetLabels[link.target] ?? link.target}
                  />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-grey">
                <RouteIcon className="size-4" strokeWidth={1.6} />
                {preview.planWeeks}-week plan · {preview.planHoursPerWeek} h/week · {preview.mostlyFree ? "mostly free" : "mixed cost"}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {previewRole.sources.map((source) => (
                <SourceChip key={`${source.dataset}-${source.releaseDate}`} source={source} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. How it works */}
      <section id="how" className="pt-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-serif text-[24px] font-medium tracking-tight">How it works</h2>
          <p className="text-[13px] text-grey">Four steps. The same four you will see at the top of every screen.</p>
        </div>
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.title} className="flex flex-col rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-full bg-sage-soft text-sage">
                  <item.icon className="size-4" strokeWidth={1.6} />
                </span>
                <span className="text-[12px] tabular-nums text-grey">{item.step}</span>
              </div>
              <h3 className="mt-4 font-serif text-[22px] leading-tight font-medium">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-grey">{item.body}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-4 text-[12px] text-ink">
                <Clock3 className="size-3.5 text-grey" strokeWidth={1.6} />
                {item.time}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Privacy + consent */}
      <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
        <div ref={consentRef} className="rounded-2xl border border-line bg-white p-6 md:col-span-8">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-sage" strokeWidth={1.6} />
            <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">PRIVACY AND CONSENT</p>
          </div>
          <h2 className="mt-2 font-serif text-[24px] font-medium tracking-tight">Before you start</h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <li>
              <p className="flex items-center gap-2 text-[14px] font-medium">
                <UserX className="size-4 text-sage" strokeWidth={1.6} />
                Synthetic data only
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-grey">
                This demo uses made-up sample CVs. Please do not upload a real CV or real personal details.
              </p>
            </li>
            <li>
              <p className="flex items-center gap-2 text-[14px] font-medium">
                <HardDrive className="size-4 text-sage" strokeWidth={1.6} />
                Nothing stored
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-grey">
                No login and no account. Your profile, answers and plan live only in this browser session.
              </p>
            </li>
            <li>
              <p className="flex items-center gap-2 text-[14px] font-medium">
                <Trash2 className="size-4 text-sage" strokeWidth={1.6} />
                Delete anytime
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-grey">
                One click clears everything from this session. Closing the tab does the same.
              </p>
            </li>
          </ul>
          <div className="mt-5 flex flex-col justify-between gap-4 border-t border-line pt-4 sm:flex-row sm:items-center">
            <label className="flex max-w-[520px] items-start gap-2.5 text-[13px] leading-relaxed">
              <button
                type="button"
                role="checkbox"
                aria-checked={consent}
                onClick={() => setConsent(!consent)}
                className={
                  consent
                    ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-ink bg-ink text-white"
                    : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-line bg-white"
                }
              >
                {consent && <Check className="size-3" strokeWidth={1.6} />}
              </button>
              I understand Laluan uses synthetic CVs, gives estimates, and does not make hiring decisions.
            </label>
            <button
              type="button"
              disabled={!consent}
              onClick={handleConsentStart}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-5 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start
              <ArrowRight className="size-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* dated sources */}
        <div className="flex flex-col rounded-2xl border border-line bg-white p-6 md:col-span-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">BUILT ON DATED PUBLIC DATA</p>
          <p className="mt-2 text-[13px] leading-relaxed text-grey">
            Every score is computed by code from these sources, and each one shows its date. AI writes explanations,
            never numbers or links.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {BUILT_ON.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-alt px-2 py-0.5 text-[11px] leading-4 text-grey"
              >
                <Database className="size-3" strokeWidth={1.6} />
                {label}
              </span>
            ))}
          </div>
          <p className="mt-auto flex items-center gap-1.5 pt-4 text-[12px] text-grey">
            <RefreshCw className="size-3.5" strokeWidth={1.6} />
            Trend signal checked {formatDayMonthYear(preview.signalsAsOf)}
          </p>
        </div>
      </section>

      {/* data note */}
      <p className="mt-8 mb-6 border-t border-line pt-4 text-[11px] leading-relaxed text-grey/80">
        The preview is the real result for Aisyah, a synthetic sample profile (SDC Hackathon demo), computed from the
        same public data as every result: ESCO skills, ILO exposure and arXiv trend counts. Scenario demand is an
        illustrative assumption. Results are estimates to support your decision, not predictions.
      </p>
    </main>
  );
}
