// Skill Radar entry point: a Sulfur card with radar line-art, a title and a pill
// link to /radar. "compact" sits under the Results exposure band; "large" closes
// sits above "See my results" on /exposure-intro.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function RadarArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden className={className}>
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="18" />
      <circle cx="32" cy="32" r="8" />
      <path d="M32 4v56M4 32h56" strokeOpacity={0.4} />
      <path d="M32 32 52 12" strokeLinecap="round" />
      <circle cx="45" cy="20" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="40" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RadarEntry({ size = "compact", className }: { size?: "compact" | "large"; className?: string }) {
  const { t } = useT();
  const large = size === "large";
  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-[40px] bg-sulfur text-ink sm:flex-row sm:items-center",
        large ? "p-8 md:p-12" : "px-7 py-6 md:px-10",
        className,
      )}
    >
      <RadarArt className={cn("shrink-0", large ? "size-20 md:size-28" : "size-12")} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p
          className={cn(
            "min-w-0 text-balance",
            large ? "font-serif text-[clamp(32px,6vw,56px)] leading-[0.9] uppercase" : "text-[18px] leading-snug font-bold",
          )}
        >
          {t("radarEntry.title")}
        </p>
        <Link href="/radar" className="btn-primary shrink-0 self-start px-5 py-2.5 text-[14px] md:self-auto">
          {t("radarEntry.cta")}
          <ArrowRight className="size-4" strokeWidth={1.6} />
        </Link>
      </div>
    </section>
  );
}
