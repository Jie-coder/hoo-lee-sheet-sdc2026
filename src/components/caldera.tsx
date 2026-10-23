// Shared Caldera primitives: the headline hero pattern, the inline source row
// that replaces the old sticky disclaimer, signal lights, SDG chips, tickets
// (notches + perforation) and illustration panels. See redesign-spec.md §0.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** The Caldera headline pattern: an Anton H1 (8 cols) with an 18px lede
 * bottom-aligned on the right (4 cols). Stacks at mobile. */
export function PageHero({
  eyebrow,
  title,
  lede,
  className,
  titleClassName,
  as = "h1",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
  titleClassName?: string;
  as?: "h1" | "h2";
}) {
  const Title = as;
  return (
    <section className={cn("grid items-end gap-5 md:grid-cols-12 md:gap-8", className)}>
      <div className="min-w-0 md:col-span-8">
        {eyebrow && (
          <p className="mb-3 font-mono text-[11px] tracking-[0.1em] text-sage-dark uppercase md:text-[12px]">{eyebrow}</p>
        )}
        <Title
          className={cn(
            "font-serif tracking-[-0.01em] text-balance uppercase",
            "text-[clamp(44px,12vw,56px)] md:text-[clamp(64px,8vw,128px)]",
            titleClassName,
            // Last on purpose: tailwind-merge drops a leading-* that comes before a
            // text-[size] class (font-size can carry a line-height), so the display
            // line-height has to follow every size class to survive cn().
            "leading-[0.9]",
          )}
        >
          {title}
        </Title>
      </div>
      {lede && <p className="text-[17px] leading-[1.4] text-balance md:col-span-4 md:text-[18px]">{lede}</p>}
    </section>
  );
}

export type SourceRowItem = { label: string; href?: string };

/** The inline source row shown under every score block: mono Pumice source
 * chips, then the two fixed lines, verbatim. Replaces the deleted sticky bar. */
export function SourceRow({
  sources = [],
  howHref,
  howOnClick,
  howLabel,
  className,
}: {
  sources?: readonly SourceRowItem[];
  howHref?: string;
  /** When set, the "how" affordance is a button (opens a drawer) rather than a link. */
  howOnClick?: () => void;
  howLabel?: string;
  className?: string;
}) {
  const { t } = useT();
  const howText = `${howLabel ?? t("results.howNumbers")} →`;
  return (
    <div className={cn("mt-6 flex flex-col gap-2.5 text-[12px] text-grey", className)}>
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sources.map((source) =>
            source.href ? (
              <a
                key={source.label}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-ink uppercase transition-colors hover:bg-alt"
              >
                {source.label}
              </a>
            ) : (
              <span
                key={source.label}
                className="rounded-full bg-paper px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-ink uppercase"
              >
                {source.label}
              </span>
            ),
          )}
          {howOnClick ? (
            <button
              type="button"
              onClick={howOnClick}
              className="ml-1 font-mono text-[11px] tracking-[0.04em] text-sage-dark uppercase hover:underline"
            >
              {howText}
            </button>
          ) : howHref ? (
            <a href={howHref} className="ml-1 font-mono text-[11px] tracking-[0.04em] text-sage-dark uppercase hover:underline">
              {howText}
            </a>
          ) : null}
        </div>
      )}
      <p className="leading-relaxed">
        {t("sourceRow.decisionLine")} {t("sourceRow.estimatesLine")}
      </p>
    </div>
  );
}

type SignalLevel = "low" | "medium" | "high" | "pending";
const SIGNAL_BG: Record<SignalLevel, string> = {
  low: "bg-signal-low",
  medium: "bg-signal-medium",
  high: "bg-signal-high",
  pending: "bg-signal-pending",
};

/** A dot with a 1.5px Obsidian ring, always paired with a text label. */
export function SignalLight({
  level,
  label,
  size = 14,
  className,
}: {
  level: SignalLevel;
  label?: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={cn("inline-block rounded-full ring-[1.5px] ring-ink", SIGNAL_BG[level])}
      />
      {label != null && <span>{label}</span>}
    </span>
  );
}

/** Sulfur mono chip, e.g. "SDG 8.2 Productivity via technology". */
export function SdgChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sulfur px-3 py-1 font-mono text-[11px] tracking-[0.04em] text-ink uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A Limestone ticket card (40px radius) with optional side notches. Notch
 * circles are drawn in the page colour so they read as cut-outs. */
export function Ticket({
  children,
  className,
  notch = false,
  notchTop = "50%",
  notchColor = "bg-paper",
}: {
  children: ReactNode;
  className?: string;
  notch?: boolean;
  notchTop?: string;
  notchColor?: string;
}) {
  return (
    <div className={cn("relative rounded-[40px] bg-card", notch && "overflow-visible", className)}>
      {notch && (
        <>
          <span
            aria-hidden
            style={{ top: notchTop }}
            className={cn("absolute -left-[18px] size-9 -translate-y-1/2 rounded-full max-md:size-6 max-md:-left-3", notchColor)}
          />
          <span
            aria-hidden
            style={{ top: notchTop }}
            className={cn("absolute -right-[18px] size-9 -translate-y-1/2 rounded-full max-md:size-6 max-md:-right-3", notchColor)}
          />
        </>
      )}
      {children}
    </div>
  );
}

/** A dashed perforation divider. */
export function Perforation({ className }: { className?: string }) {
  return <div aria-hidden className={cn("border-t-[1.5px] border-dashed border-ink/25", className)} />;
}

/**
 * Progressive-disclosure surface (spec §0): a right-side drawer on desktop and
 * a bottom sheet at 390. Closes on backdrop click or Escape. The trigger owns
 * `open`; this only renders the panel.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const { t } = useT();
  const reduce = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hidden = isDesktop ? { x: "100%" } : { y: "100%" };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.button
            type="button"
            aria-label={t("drawer.close")}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className={cn(
              "absolute flex max-h-full flex-col overflow-y-auto bg-card",
              isDesktop
                ? "top-0 right-0 h-full w-[min(440px,90vw)] rounded-l-[32px] p-8"
                : "right-0 bottom-0 left-0 max-h-[86vh] rounded-t-[32px] p-6",
            )}
            initial={reduce ? false : hidden}
            animate={reduce ? undefined : { x: 0, y: 0 }}
            exit={reduce ? undefined : hidden}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-serif text-[24px] leading-[0.9] uppercase">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("drawer.close")}
                className="shrink-0 rounded-full p-1.5 text-grey transition-colors hover:bg-alt hover:text-ink"
              >
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** An isometric illustration panel on a Plasma or Ember block. */
export function IllustrationPanel({
  src,
  panel,
  alt = "",
  className,
}: {
  src: string;
  panel: "plasma" | "ember";
  alt?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[40px]",
        panel === "ember" ? "bg-sage" : "bg-plasma",
        className,
      )}
      aria-hidden={alt === ""}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static decorative illustration */}
      <img src={src} alt={alt} className="size-full object-cover" />
    </div>
  );
}
