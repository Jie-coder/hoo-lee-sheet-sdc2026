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
import { useT, type MessageKey } from "@/lib/i18n";
import type { LandingPreview } from "@/lib/landing-preview";
import { localizeStatusLabel } from "@/lib/status-label";

const STOPS = [
  { titleKey: "nav.profile", bodyKey: "landing.stop1.body" },
  { titleKey: "nav.interview", bodyKey: "landing.stop2.body" },
  { titleKey: "nav.results", bodyKey: "landing.stop3.body" },
  { titleKey: "nav.pathway", bodyKey: "landing.stop4.body" },
] as const;

const PROMISES = [
  { icon: UserX, key: "landing.promise1" },
  { icon: HardDrive, key: "landing.promise2" },
  { icon: Database, key: "landing.promise3" },
] as const;

const BUILT_ON: ReadonlyArray<MessageKey> = [
  "landing.builtOnEsco",
  "landing.builtOnIlo",
  "landing.builtOnArxiv",
  "landing.builtOnHrdCorp",
];

export function LandingView({ preview }: { preview: LandingPreview }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { t } = useT();
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
            {t("landing.eyebrow")}
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            className="mt-4 font-serif text-[42px] leading-[1.02] font-medium tracking-tight text-balance sm:text-[56px] md:text-[64px]"
          >
            {t("landing.title")}
          </motion.h1>
          <motion.p {...rise(0.16)} className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-grey">
            {t("landing.lede")}
          </motion.p>
          <motion.div {...rise(0.24)} className="mt-8 flex flex-col gap-4">
            <button type="button" onClick={handleStart} className="btn-primary self-start px-6 py-3 text-[15px]">
              {t("landing.start")}
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
              {t("landing.consent")}
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
      <section id="about" className="border-t border-line py-16 md:py-20">
        <Reveal>
          <h2 className="font-serif text-[28px] font-medium tracking-tight md:text-[32px]">{t("landing.stopsTitle")}</h2>
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
              <StaggerItem key={stop.titleKey} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-paper ${index === 0 ? "border-sage bg-sage" : "border-sage"}`}
                />
                <div className="md:mt-2">
                  <p className="text-[15px] font-medium">{t(stop.titleKey)}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-grey">{t(stop.bodyKey)}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div id="privacy">
          <Reveal delay={0.1} className="mt-16 flex flex-col gap-5 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
              {PROMISES.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <item.icon className="size-4 text-sage" strokeWidth={1.6} />
                  {t(item.key)}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {BUILT_ON.map((labelKey) => (
                <span key={labelKey} className="tag">
                  {t(labelKey)}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
        <p className="mt-4 text-[12px] text-grey/80">
          {t("landing.trendChecked", {
            date: formatDayMonthYear(preview.signalsAsOf, t),
            name: preview.personaName,
          })}
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
  const { t } = useT();
  const role = preview.role;
  return (
    <div className="panel relative flex min-h-[240px] w-full flex-col gap-4 overflow-hidden p-5 sm:block sm:aspect-[5/4] sm:min-h-0 sm:p-6">
      <RouteLine
        d="M 40 280 C 200 280, 340 250, 362 150 S 372 70, 372 44"
        viewBox="0 0 400 320"
        preserveAspectRatio="none"
        strokeWidth={3}
        delay={0.6}
        duration={1.8}
        className="absolute inset-0 hidden h-full w-full sm:block"
      >
        <RouteDot cx={40} cy={280} r={6} delay={0.5} />
        <RouteDot cx={253} cy={252} r={4} delay={1.5} filled={false} />
        <RouteDot cx={372} cy={44} r={7} delay={2.2} />
      </RouteLine>

      {/* today: sits above the first station */}
      <div className="max-w-[70%] sm:absolute sm:bottom-[19%] sm:left-[6%] sm:max-w-[48%]">
        <p className="text-[12px] text-grey capitalize">{preview.currentTitle}</p>
        <p className="mt-0.5 font-serif text-[30px] leading-none font-medium tracking-tight sm:text-[36px]">
          {bandLabel(preview.currentExposure, t)}{" "}
          <span className="text-[20px] text-grey/70 sm:text-[22px]">
            <CountUp value={preview.currentExposure} decimals={2} />
          </span>
        </p>
        <p className="mt-1 text-[12px] text-grey">{t("landing.exposureToday")}</p>
      </div>

      {/* the plan */}
      <div className="sm:absolute sm:top-6 sm:left-6">
        <span className="tag bg-sage-wash text-sage-dark">
          {t("landing.planChip", {
            weeks: String(preview.planWeeks),
            cost: preview.mostlyFree ? t("pathway.mostlyFree") : t("pathway.mixedCost"),
          })}
        </span>
      </div>

      {/* the move: left of the last station */}
      <div className="max-w-[80%] sm:absolute sm:top-[12%] sm:right-[13%] sm:max-w-[56%] sm:text-right">
        <p className="font-serif text-[20px] leading-tight font-medium capitalize sm:text-[24px]">{role.title}</p>
        <p className="mt-1 font-serif text-[30px] leading-none font-medium tracking-tight text-sage sm:text-[36px]">
          {bandLabel(role.exposure, t)}{" "}
          <span className="text-[20px] text-sage/70 sm:text-[22px]">
            <CountUp value={role.exposure} decimals={2} />
          </span>
        </p>
        <p className="mt-1 text-[12px] text-grey">{t("landing.exposureAfterMove")}</p>
        {preview.robust && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-medium text-sage-dark">
            <ShieldCheck className="size-3" strokeWidth={1.8} />
            {localizeStatusLabel(preview.statusLabel, t)}
          </span>
        )}
      </div>

      <p className="text-[11px] text-grey/70 sm:absolute sm:right-6 sm:bottom-4">
        {t("landing.exposureNotJobLoss")}
      </p>
    </div>
  );
}
