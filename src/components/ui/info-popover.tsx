// Click-to-open "ⓘ" popover for long explanations (scenario descriptions,
// "Why we ask", "How this plan was built"). A real button with
// aria-expanded/aria-controls so it's keyboard operable; closes on Escape
// or an outside click/focus.
"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoPopover({
  label = "More info",
  children,
  className,
  panelClassName,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onFocusIn(event: FocusEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center text-grey hover:text-ink"
      >
        <Info className="size-4" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          id={id}
          role="note"
          className={cn(
            "absolute top-6 left-0 z-20 w-[300px] max-w-[80vw] rounded-xl border border-line bg-white p-3 text-[13px] leading-relaxed text-grey shadow-md",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
