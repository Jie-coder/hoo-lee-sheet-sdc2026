// App header (Caldera §0): wordmark left, the flow rail (mono stations with
// ringed dots and dashed links) on flow pages or the site nav on content pages,
// and the EN·BM toggle right. Plain — no bar background.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SITE_LOCALES, useT } from "@/lib/i18n";
import { LOGO_SRC } from "@/components/site-footer";

const STEPS = [
  { id: "profile" },
  { id: "interview" },
  { id: "results" },
  { id: "pathway" },
] as const;

const SITE_LINKS = [
  { href: "/about", key: "footer.about" },
  { href: "/data-sources", key: "footer.sources" },
  { href: "/privacy", key: "footer.privacy" },
  { href: "/radar", key: "footer.radar" },
] as const;

function currentStepIndex(pathname: string): number {
  // The exposure interstitial sits between the interview and results.
  if (pathname.startsWith("/exposure-intro")) return STEPS.findIndex((step) => step.id === "interview");
  return STEPS.findIndex((step) => pathname.startsWith(`/${step.id}`));
}

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useT();
  const currentIndex = currentStepIndex(pathname);
  const onFlow = currentIndex >= 0;

  return (
    <header className="w-full">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-4 px-4 sm:px-6 md:px-8">
        <Link href="/" className="shrink-0" aria-label={t("header.homeAria")}>
          {/* Official wordmark. next/image refuses SVG without extra config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={t("header.logoAlt")} width={125} height={28} className="h-7 w-[125px]" />
        </Link>

        {!onFlow && (
          <nav aria-label={t("header.siteNavAria")} className="ml-6 hidden items-center gap-1 md:flex">
            {SITE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-[14px] text-ink/80 transition-colors hover:bg-alt hover:text-ink"
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
        )}

        {onFlow && (
          <nav aria-label={t("header.progressAria")} className="hidden min-w-0 flex-1 justify-center md:flex">
            <ol className="flex items-center font-mono text-[12px] tracking-[0.06em] uppercase">
              {STEPS.map((step, index) => {
                const complete = index < currentIndex;
                const current = index === currentIndex;
                const label = t(`nav.${step.id}`);
                const dot = (
                  <span
                    aria-hidden
                    className={cn(
                      "size-3 rounded-full ring-[1.5px] ring-ink transition-colors",
                      current && "bg-ink",
                      complete && "bg-ink/35 group-hover:bg-sage group-focus-visible:bg-sage",
                      !current && !complete && "bg-transparent ring-grey/50",
                    )}
                  />
                );
                return (
                  <li key={step.id} className="flex items-center">
                    {complete ? (
                      <Link
                        href={`/${step.id}`}
                        data-step-state="complete"
                        className="group flex items-center gap-2 rounded-full px-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        {dot}
                        <span className="text-grey underline-offset-4 group-hover:text-ink group-hover:underline group-focus-visible:underline">
                          {label}
                        </span>
                      </Link>
                    ) : current ? (
                      <span aria-current="step" data-step-state="current" className="flex items-center gap-2 px-3.5">
                        {dot}
                        <span className="text-ink">{label}</span>
                      </span>
                    ) : (
                      <span
                        role="link"
                        aria-disabled="true"
                        title={t("nav.stepDisabled")}
                        data-step-state="upcoming"
                        className="flex cursor-not-allowed items-center gap-2 px-3.5"
                      >
                        {dot}
                        <span className="text-grey/60">{label}</span>
                      </span>
                    )}
                    {index < STEPS.length - 1 && (
                      <span aria-hidden className="w-10 border-t-[1.5px] border-dashed border-ink/40" />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {/* Flow, mobile: a compact "n/4" plus a 4-segment bar (full label for screen readers). */}
        {onFlow && (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:hidden">
            <span className="font-mono text-[11px] leading-snug break-words tracking-[0.06em] text-ink uppercase">
              <span aria-hidden>
                {currentIndex + 1}/{STEPS.length}
              </span>
              <span className="sr-only">
                {t("header.stepOf", {
                  n: String(currentIndex + 1),
                  total: String(STEPS.length),
                  label: t(`nav.${STEPS[currentIndex].id}`),
                })}
              </span>
            </span>
            <div className="flex gap-1">
              {STEPS.map((step, index) => (
                <span
                  key={step.id}
                  className={cn("h-1 flex-1 rounded-full", index <= currentIndex ? "bg-ink" : "bg-ink/15")}
                />
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {!onFlow && (
            <span className="hidden font-mono text-[11px] tracking-[0.08em] text-grey uppercase lg:inline">
              {t("header.builtFor")}
            </span>
          )}
          <div
            role="group"
            aria-label={t("lang.label")}
            className="relative flex items-center rounded-full border border-ink/20 p-0.5 text-[12px]"
          >
            {SITE_LOCALES.map((language) => {
              const selected = locale === language.id;
              return (
                <button
                  key={language.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLocale(language.id)}
                  className={cn(
                    "relative z-10 rounded-full px-2.5 py-1 font-mono tracking-[0.04em] transition-colors",
                    selected ? "text-paper" : "text-grey hover:text-ink",
                  )}
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
