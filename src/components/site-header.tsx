// App header: Laluan wordmark, the four steps drawn as stations on one
// route line (the laluan), and the course-language preference pill.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/motion";
import { SITE_LOCALES, useT } from "@/lib/i18n";

const STEPS = [
  { id: "profile" },
  { id: "interview" },
  { id: "results" },
  { id: "pathway" },
] as const;

function currentStepIndex(pathname: string): number {
  return STEPS.findIndex((step) => pathname.startsWith(`/${step.id}`));
}

export function SiteHeader() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { locale, setLocale, t } = useT();
  const currentIndex = currentStepIndex(pathname);
  const onFlow = currentIndex >= 0;
  // The sage line reaches the centre of the current station.
  const fill = onFlow ? currentIndex / (STEPS.length - 1) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1248px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Laluan home">
          {/* Official wordmark. next/image refuses SVG without extra config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/laluan-logo.svg" alt="Laluan" className="h-7 w-auto" />
        </Link>

        {onFlow && (
          <nav aria-label="Progress" className="hidden min-w-0 flex-1 justify-center md:flex">
            <ol className="relative grid w-full max-w-[420px] grid-cols-4">
              {/* guide + fill, drawn between the first and last station centres */}
              <span aria-hidden className="absolute top-[7px] right-[12.5%] left-[12.5%] h-px bg-line" />
              <motion.span
                aria-hidden
                className="absolute top-[7px] left-[12.5%] h-px origin-left bg-sage"
                style={{ width: "75%" }}
                initial={reduce ? { scaleX: fill } : { scaleX: 0 }}
                animate={{ scaleX: fill }}
                transition={{ duration: reduce ? 0 : 0.9, ease: EASE_OUT }}
              />
              {STEPS.map((step, index) => {
                const complete = index < currentIndex;
                const current = index === currentIndex;
                return (
                  <li
                    key={step.id}
                    className="relative flex flex-col items-center gap-1.5"
                    aria-current={current ? "step" : undefined}
                  >
                    <motion.span
                      className={cn(
                        "flex size-[15px] items-center justify-center rounded-full border-2 bg-paper",
                        complete && "border-sage bg-sage text-paper",
                        current && "border-ink bg-ink",
                        !complete && !current && "border-line",
                      )}
                      initial={reduce ? false : { scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 24, delay: reduce ? 0 : 0.25 + index * 0.12 }}
                    >
                      {complete && <Check className="size-2.5" strokeWidth={3} />}
                    </motion.span>
                    <span className={cn("text-[11px] tracking-wide", current ? "font-medium text-ink" : "text-grey")}>
                      {t(`nav.${step.id}`)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="flex items-center gap-3">
          {onFlow && (
            <span className="text-[12px] text-grey md:hidden">
              {currentIndex + 1}/{STEPS.length} {t(`nav.${STEPS[currentIndex].id}`)}
            </span>
          )}
          <div
            role="group"
            aria-label={t("lang.label")}
            className="relative flex items-center rounded-full border border-line bg-white p-0.5 text-[12px]"
          >
            {SITE_LOCALES.map((language) => {
              const selected = locale === language.id;
              return (
                <button
                  key={language.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLocale(language.id)}
                  className={cn("relative z-10 rounded-full px-2.5 py-1 transition-colors", selected ? "text-paper" : "text-grey hover:text-ink")}
                >
                  {selected && (
                    <motion.span
                      layoutId="site-language-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-ink"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  {language.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
