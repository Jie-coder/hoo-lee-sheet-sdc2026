// Generic expand/collapse control: a real button with aria-expanded/aria-controls,
// so every "Details" / "+N more" / sidebar summary in the declutter redesign is
// keyboard operable the same way. Content is collapsed by default unless opened.
"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  chevron = true,
  className,
  summaryClassName,
  contentClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Set false for triggers like "+2 more" that don't need a chevron. */
  chevron?: boolean;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className={cn("flex w-full items-center justify-between gap-2 text-left", summaryClassName)}
      >
        {summary}
        {chevron && (
          <ChevronDown
            className={cn("size-4 shrink-0 text-grey transition-transform", open && "rotate-180")}
            strokeWidth={1.6}
          />
        )}
      </button>
      {open && (
        <div id={id} className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  );
}
