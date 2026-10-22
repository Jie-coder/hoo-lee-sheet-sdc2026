// Landing: one hero (the laluan drawn from today's job to the next role) with
// the consent gate, then one strip with the four stops and what we promise.
// Consent must be ticked before "Start" continues to /profile.
"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Database, HardDrive, ShieldCheck, UserX } from "lucide-react";
import { CountUp, EASE_OUT, Reveal, RouteDot, RouteLine, Stagger, StaggerItem } from "@/components/motion";
import { bandLabel, formatDayMonthYear } from "@/lib/display";
import { useFlow } from "@/context/flow-context";
import type { LandingPreview } from "@/lib/landing-preview";

const STOPS = [
  { title: "Profile", body: "Pick a sample CV. Check the skills we read." },
  { title: "Interview", body: "Five quick questions, tap to answer." },
  { title: "Results", body: "AI exposure today, three roles under three futures." },
  { title: "Pathway", body: "Your week-by-week route, free courses first." },
] as const;

const PROMISES = [
  { icon: UserX, text: "Synthetic CVs only" },
  { icon: HardDrive, text: "Nothing stored, no login" },
  { icon: Database, text: "Public data, every score dated" },
] as const;

const BUILT_ON = ["ESCO v1.2.1", "ILO GenAI Exposure 2025", "arXiv 90-day counts", "HRD Corp e-LATiH + 11 providers"];

export function LandingView({ preview }: { preview: LandingPreview }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { consent, setConsent } = useFlow();
  const consentRef = useRef<HTMLLabelElement>(null);

  function handleStart() {
    if (consent) {
      router.push("/profile");
      return;
    }
    consentRef.current?.focus();
    consentRef.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
      { duration: 260 },
    );
  }

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT },
  });

  return (
    <div className="mx-auto max-w-[1248px] px-4 sm:px-6">
      {/* Hero: copy left, the laluan right */}
      <section className="grid grid-cols-1 items-center gap-10 pt-12 pb-16 md:grid-cols-12 md:gap-8 md:pt-20 md:pb-24">
        <div className="md:col-span-6">
          <motion.p {...rise(0)} className="text-[12px] font-medium tracking-[0.14em] text-sage uppercase">
            Free, 3 minutes, no login
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            className="mt-4 font-serif text-[42px] leading-[1.02] font-medium tracking-tight text-balance sm:text-[56px] md:text-[64px]"
          >
            Your route through AI at work.
          </motion.h1>
          <motion.p {...rise(0.16)} className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-grey">
            Laluan reads a CV, scores how much AI touches your tasks, and draws a free week-by-week path to a role
            that fits.
          </motion.p>
          <motion.div {...rise(0.24)} className="mt-8 flex flex-col gap-4">
            <button type="button" data-testid="landing-start" onClick={handleStart} className="btn-primary self-start px-6 py-3 text-[15px]">
              Start
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </button>
            <label
              ref={consentRef}
              tabIndex={-1}
              className="flex max-w-[520px] cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-grey outline-none"
            >
              <button
                type="button"
                role="checkbox"
                data-testid="landing-consent"
                aria-checked={consent}
                onClick={() => setConsent(!consent)}
                className={
                  consent
                    ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-ink bg-ink text-paper transition-colors"
                    : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-grey/50 bg-white transition-colors hover:border-ink"
                }
              >
                {consent && <Check className="size-3" strokeWidth={2.4} />}
              </button>
              I understand Laluan uses synthetic CVs, gives estimates, and does not make hiring decisions.
            </label>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE_OUT }}
          className="md:col-span-6 md:pl-6"
        >
          <PreviewRoute preview={preview} />
        </motion.div>
      </section>

      {/* The four stops, drawn as one line */}
      <section className="border-t border-line py-16 md:py-20">
        <Reveal>
          <h2 className="font-serif text-[28px] font-medium tracking-tight md:text-[32px]">Four stops. About three minutes.</h2>
        </Reveal>
        <div className="relative mt-10">
          <RouteLine
            d="M 0 1 H 1000"
            viewBox="0 0 1000 2"
            preserveAspectRatio="none"
            strokeWidth={2}
            duration={1.4}
            className="absolute top-[7px] right-[12.5%] left-[12.5%] hidden h-[2px] w-[75%] md:block"
          />
          <Stagger className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6" delay={0.3} gap={0.18}>
            {STOPS.map((stop, index) => (
              <StaggerItem key={stop.title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-paper ${index === 0 ? "border-sage bg-sage" : "border-sage"}`}
                />
                <div className="md:mt-2">
                  <p className="text-[15px] font-medium">{stop.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-grey">{stop.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal delay={0.1} className="mt-16 flex flex-col gap-5 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            {PROMISES.map((item) => (
              <li key={item.text} className="flex items-center gap-2">
                <item.icon className="size-4 text-sage" strokeWidth={1.6} />
                {item.text}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {BUILT_ON.map((label) => (
              <span key={label} className="tag">
                {label}
              </span>
            ))}
          </div>
        </Reveal>
        <p className="mt-4 text-[12px] text-grey/80">
          Trend signal checked {formatDayMonthYear(preview.signalsAsOf)}. The preview above is the real result for
          Aisyah, a synthetic sample profile.
        </p>
      </section>
    </div>
  );
}

/**
 * The laluan itself: one line from today's job (bottom left) to the chosen
 * role (top right), built from the sample persona's real result.
 */
function PreviewRoute({ preview }: { preview: LandingPreview }) {
  const role = preview.role;
  return (
    <div className="panel relative aspect-[5/4] w-full overflow-hidden p-5 sm:p-6">
      <RouteLine
        d="M 40 280 C 200 280, 340 250, 362 150 S 372 70, 372 44"
        viewBox="0 0 400 320"
        preserveAspectRatio="none"
        strokeWidth={3}
        delay={0.6}
        duration={1.8}
        className="absolute inset-0 h-full w-full"
      >
        <RouteDot cx={40} cy={280} r={6} delay={0.5} />
        <RouteDot cx={253} cy={252} r={4} delay={1.5} filled={false} />
        <RouteDot cx={372} cy={44} r={7} delay={2.2} />
      </RouteLine>

      {/* today: sits above the first station */}
      <div className="absolute bottom-[19%] left-[6%] max-w-[48%]">
        <p className="text-[12px] text-grey capitalize">{preview.currentTitle}</p>
        <p className="mt-0.5 font-serif text-[30px] leading-none font-medium tracking-tight sm:text-[36px]">
          {bandLabel(preview.currentExposure)}{" "}
          <span className="text-[20px] text-grey/70 sm:text-[22px]">
            <CountUp value={preview.currentExposure} decimals={2} />
          </span>
        </p>
        <p className="mt-1 text-[12px] text-grey">AI exposure today</p>
      </div>

      {/* the plan */}
      <div className="absolute top-5 left-5 sm:top-6 sm:left-6">
        <span className="tag bg-sage-wash text-sage-dark">
          {preview.planWeeks} weeks, {preview.mostlyFree ? "mostly free" : "mixed cost"}
        </span>
      </div>

      {/* the move: left of the last station */}
      <div className="absolute top-[12%] right-[13%] max-w-[56%] text-right">
        <p className="font-serif text-[20px] leading-tight font-medium capitalize sm:text-[24px]">{role.title}</p>
        <p className="mt-1 font-serif text-[30px] leading-none font-medium tracking-tight text-sage sm:text-[36px]">
          {bandLabel(role.exposure)}{" "}
          <span className="text-[20px] text-sage/70 sm:text-[22px]">
            <CountUp value={role.exposure} decimals={2} />
          </span>
        </p>
        <p className="mt-1 text-[12px] text-grey">AI exposure after the move</p>
        {preview.robust && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-medium text-sage-dark">
            <ShieldCheck className="size-3" strokeWidth={1.8} />
            {preview.statusLabel}
          </span>
        )}
      </div>

      <p className="absolute right-5 bottom-4 text-[11px] text-grey/70 sm:right-6">Exposure is not job loss.</p>
    </div>
  );
}
