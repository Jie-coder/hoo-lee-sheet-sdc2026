// Landing: one hero (the laluan drawn from today's job to the next role) with
// the consent gate, then one strip with the four stops and what we promise.
// Consent must be ticked before "Start" continues to /profile.
"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Database, HardDrive, UserX } from "lucide-react";
import { LandingHeroCanvas } from "@/components/landing-hero-canvas";
import { EASE_OUT, Reveal, RouteLine, Stagger, StaggerItem } from "@/components/motion";
import { formatDayMonthYear } from "@/lib/display";
import { useFlow } from "@/context/flow-context";
import { useT, type MessageKey } from "@/lib/i18n";
import type { LandingPreview } from "@/lib/landing-preview";

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
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-8">
      {/* Hero: the ticket canvas with the route copy in its cut-outs */}
      <section id="start" className="scroll-mt-20 pt-8 pb-14 md:pt-10 md:pb-16">
        <div className="relative">
          <div className="relative z-10 xl:absolute xl:top-2 xl:left-0 xl:z-20">
            <motion.p
              {...rise(0)}
              className="font-mono text-[10px] tracking-[0.16em] text-sage-dark uppercase md:text-[12px]"
            >
              {t("landing.eyebrow")}
            </motion.p>
            <motion.h1
              {...rise(0.08)}
              className="mt-3 max-w-[900px] font-serif text-[clamp(52px,12vw,84px)] leading-[0.92] tracking-[-0.01em] text-balance uppercase xl:mt-4 xl:text-[clamp(64px,8vw,120px)]"
            >
              {t("landing.title")}
            </motion.h1>
          </div>

          <div className="relative mt-6 aspect-[1376/520] overflow-hidden xl:mt-0 xl:aspect-[1376/820]">
            <LandingHeroCanvas className="absolute bottom-0 left-0 aspect-[1376/820] w-full" />
            <span className="absolute top-2 left-3 rounded-md bg-ink/55 px-2 py-1.5 font-mono text-[9px] leading-none tracking-[0.08em] text-card uppercase xl:top-[43%] xl:left-7 xl:px-2.5 xl:text-[12px]">
              {t("landing.heroTicket")}
            </span>
            <span className="absolute top-2 right-3 rounded-md bg-ink/55 px-2 py-1.5 font-mono text-[9px] leading-none tracking-[0.08em] text-card uppercase xl:top-7 xl:right-7 xl:px-2.5 xl:text-[12px]">
              {t("landing.heroSdg")}
            </span>
            <span className="absolute bottom-2 left-3 rounded-md bg-ink/55 px-2 py-1.5 font-mono text-[9px] leading-none tracking-[0.08em] text-card uppercase xl:bottom-7 xl:left-7 xl:px-2.5 xl:text-[12px]">
              {t("landing.heroRoute")}
            </span>
          </div>

          <motion.div
            {...rise(0.24)}
            className="mt-6 xl:absolute xl:right-8 xl:bottom-8 xl:z-20 xl:mt-0 xl:w-[460px]"
          >
            <p className="text-[17px] leading-[1.45] text-balance xl:text-[19px]">{t("landing.lede")}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={handleStart} className="btn-primary px-5 py-3 text-[15px]">
                {t("landing.start")}
                <ArrowRight className="size-4" strokeWidth={1.8} />
              </button>
              <a href="#about" className="btn-secondary px-5 py-3 text-[15px]">
                {t("landing.howItWorks")}
              </a>
            </div>
            <label
              ref={consentRef}
              tabIndex={-1}
              className="mt-4 flex max-w-[460px] cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-grey outline-none"
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

