// The orange sponsored ticket (Be Our Partner demo, mock v2). Shared by the
// pathway stop placement and the /partner hero preview. Display only: it never
// feeds scoring, ranking, the plan, progress or the certificate.
"use client";

import { useState } from "react";
import type { useT } from "@/lib/i18n";
import type { SponsoredCourse } from "@/lib/sponsored";
import { cn } from "@/lib/utils";

type T = ReturnType<typeof useT>["t"];

export function SponsoredCard({
  t,
  course,
  skillLabel,
  corner,
  withWhy = true,
  className,
}: {
  t: T;
  course: SponsoredCourse;
  skillLabel: string;
  /** Top-right mono label, e.g. "1 of max 1 · this stop". */
  corner?: string;
  withWhy?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className={cn("sponsored-card text-ink", className)} aria-label={t("sponsored.tag")}>
      <div className="sponsored-card__top px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-[6px] bg-sage px-2 py-0.5 font-data text-[10.5px] tracking-[0.08em] text-obsidian uppercase">
            {t("sponsored.tag")}
          </span>
          {corner && <span className="font-data text-[10.5px] tracking-[0.06em] text-grey uppercase">{corner}</span>}
        </div>
        <h4 className="mt-3 font-sans text-[15px] leading-[1.3] font-semibold normal-case tracking-normal sm:text-[17px]">{course.title}</h4>
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="sponsored-badges">
          {course.badges.map((badge) => (
            <span key={badge.label} className="sponsored-pill">
              <span aria-hidden className="text-sage">
                {badge.icon}
              </span>
              {badge.label}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[14px]">
          {t("sponsored.matches")}{" "}
          <b className="rounded-[6px] bg-[#ffd3b8] px-1.5 py-px font-medium text-[#9a3000]">{skillLabel}</b>
        </p>
      </div>
      <div className="sponsored-card__tear" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-2.5 px-5 pt-3.5 pb-4 sm:px-6">
        <p className="text-[14px]">
          {course.provider}
          <span className="block whitespace-nowrap sm:ml-2.5 sm:inline">
            <b className="text-[15px]">{course.price}</b>
            <s className="ml-1.5 text-[12.5px] text-[#6b4a3a]" aria-label={t("sponsored.listPrice", { price: course.listPrice })}>
              {course.listPrice}
            </s>
          </span>
        </p>
        {withWhy && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px] underline underline-offset-[3px]",
              open ? "text-plasma" : "text-ink",
            )}
          >
            <span aria-hidden className="grid size-4 place-items-center rounded-full border-[1.5px] border-current text-[10px] no-underline">
              i
            </span>
            {t("sponsored.why")}
          </button>
        )}
        {withWhy && open && (
          <p
            role="note"
            className="absolute right-3 bottom-14 left-3 z-10 max-w-[300px] rounded-[16px] bg-obsidian px-[18px] py-4 text-[14px] leading-[1.45] text-limestone shadow-[0_18px_40px_rgba(7,6,7,0.3)] sm:left-auto sm:w-[300px] ml-auto"
          >
            {t("sponsored.whyBody")}
            {/* Tail pointing down at the "Why am I seeing this?" trigger. */}
            <span aria-hidden className="absolute -bottom-[7px] right-8 size-3.5 rotate-45 bg-obsidian" />
          </p>
        )}
      </div>
    </article>
  );
}
