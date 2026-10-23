// Landing: one hero (the laluan drawn from today's job to the next role) with
// the consent gate, then one strip with the four stops and what we promise.
// Consent must be ticked before "Start" continues to /profile.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { LandingHeroCanvas } from "@/components/landing-hero-canvas";
import { EASE_OUT, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SdgChip } from "@/components/caldera";
import { formatDayMonthYear } from "@/lib/display";
import { useFlow } from "@/context/flow-context";
import { useT, type MessageKey } from "@/lib/i18n";
import type { LandingPreview } from "@/lib/landing-preview";

/** Three marketing stops (spec §1), alternating Ember/Plasma/Ember numbers. */
const STOPS = [
  { titleKey: "landing.stopA.title", bodyKey: "landing.stopA.body", footKey: "landing.stopA.foot", accent: "sage", sulfur: false },
  { titleKey: "landing.stopB.title", bodyKey: "landing.stopB.body", footKey: "landing.stopB.foot", accent: "plasma", sulfur: false },
  { titleKey: "landing.stopC.title", bodyKey: "landing.stopC.body", footKey: "landing.stopC.foot", accent: "sage", sulfur: true },
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
              {t("landing.heroHeading")}
            </motion.h1>
          </div>

          <div className="relative mt-6 aspect-[1376/520] min-h-[220px] overflow-hidden rounded-[28px] xl:mt-0 xl:aspect-[1376/820] xl:min-h-0 xl:rounded-none">
            <LandingHeroCanvas className="absolute inset-0 size-full xl:inset-auto xl:bottom-0 xl:left-0 xl:aspect-[1376/820] xl:h-auto" />
            <span className="absolute top-2 left-3 rounded-md bg-ink/55 px-2 py-1.5 font-mono text-[9px] leading-none tracking-[0.08em] text-card uppercase xl:top-[43%] xl:left-7 xl:px-2.5 xl:text-[12px]">
              {t("landing.heroTicket")}
            </span>
            <span className="absolute top-2 right-3 hidden rounded-md sm:block bg-ink/55 px-2 py-1.5 font-mono text-[9px] leading-none tracking-[0.08em] text-card uppercase xl:top-7 xl:right-7 xl:px-2.5 xl:text-[12px]">
              {t("landing.heroSdg")}
            </span>
            <span className="absolute bottom-2 left-3 hidden rounded-md sm:block bg-ink/55 px-2 py-1.5 font-mono text-[9px] leading-none tracking-[0.08em] text-card uppercase xl:bottom-7 xl:left-7 xl:px-2.5 xl:text-[12px]">
              {t("landing.heroRoute")}
            </span>
          </div>

          <motion.div
            {...rise(0.24)}
            className="mt-6 xl:absolute xl:right-0 xl:bottom-0 xl:z-20 xl:mt-0 xl:w-[520px] xl:rounded-tl-[40px] xl:bg-paper xl:pt-8 xl:pl-8"
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
              className="mt-4 flex max-w-[460px] cursor-pointer items-center gap-2.5 text-[12px] leading-snug text-grey outline-none"
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
              <span>
                {t("landing.consentShort")}{" "}
                <Link href="/privacy" className="font-medium text-sage-dark underline underline-offset-2">
                  {t("landing.consentDetails")}
                </Link>
              </span>
            </label>
          </motion.div>
        </div>
      </section>

      {/* THREE STOPS TO YOUR NEXT ROLE */}
      <section id="about" className="py-20 md:py-28">
        <div className="grid items-end gap-5 md:grid-cols-12 md:gap-8">
          <Reveal className="md:col-span-7">
            <h2 className="font-serif text-[44px] leading-[0.92] uppercase md:text-[clamp(56px,6vw,96px)]">
              {t("landing.threeStopsHeading")}
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-4 md:col-start-9">
            <p className="text-[17px] leading-[1.45] text-grey md:text-[19px]">{t("landing.threeStopsLede")}</p>
          </Reveal>
        </div>

        <Stagger className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3" delay={0.2} gap={0.16}>
          {STOPS.map((stop, index) => (
            <StaggerItem
              key={stop.titleKey}
              className="relative flex min-h-[320px] flex-col overflow-hidden rounded-[40px] bg-card p-8 md:p-10"
            >
              <p className={`font-serif text-[64px] leading-none md:text-[72px] ${stop.accent === "plasma" ? "text-plasma" : "text-sage"}`}>
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-6 text-[26px] leading-tight font-bold">{t(stop.titleKey)}</p>
              <p className="mt-3 text-[16px] leading-relaxed text-grey">{t(stop.bodyKey)}</p>
              <div aria-hidden className="relative mt-auto pt-8">
                <span className="absolute top-8 -left-12 size-9 -translate-y-1/2 rounded-full bg-paper max-md:-left-11 max-md:size-8" />
                <span className="absolute top-8 -right-12 size-9 -translate-y-1/2 rounded-full bg-paper max-md:-right-11 max-md:size-8" />
                <div className="border-t-[1.5px] border-dashed border-ink/20" />
                <div className="mt-5 flex items-center justify-between">
                  {stop.sulfur ? (
                    <span className="rounded-md bg-sulfur px-2 py-1 font-mono text-[11px] tracking-[0.06em] text-ink uppercase">
                      {t(stop.footKey)}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] tracking-[0.06em] text-grey uppercase">{t(stop.footKey)}</span>
                  )}
                  <span className="flex gap-1.5">
                    <i className="size-2.5 rounded-full bg-line" />
                    <i className="size-2.5 rounded-full bg-line" />
                    <i className="size-2.5 rounded-full bg-line" />
                  </span>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Built on public labour data (Plasma block) */}
      <section id="privacy" className="pb-20 md:pb-28">
        <Reveal className="overflow-hidden rounded-[40px] bg-plasma px-8 py-12 text-card md:px-12 md:py-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-serif text-[32px] leading-[0.95] uppercase md:text-[48px]">{t("landing.sourcesBlockHeading")}</h2>
              <p className="mt-3 max-w-[460px] text-[15px] text-card/80">{t("landing.sourcesBlockLede")}</p>
            </div>
            <Link
              href="/data-sources"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-card px-5 py-3 text-[14px] font-bold text-card transition-colors hover:bg-card hover:text-plasma"
            >
              {t("footer.sources")}
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2">
            {BUILT_ON.map((labelKey) => (
              <li
                key={labelKey}
                className="rounded-full bg-card/15 px-3 py-1.5 font-mono text-[11px] tracking-[0.04em] text-card uppercase"
              >
                {t(labelKey)}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-card/70">
            <SdgChip>{t("landing.heroSdg")}</SdgChip>
            {t("landing.trendChecked", {
              date: formatDayMonthYear(preview.signalsAsOf, t),
              name: preview.personaName,
            })}
          </p>
        </Reveal>
      </section>
    </div>
  );
}

