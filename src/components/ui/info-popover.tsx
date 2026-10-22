// Hover (desktop) or tap (mobile) "ⓘ" popover for long explanations (scenario descriptions,
// "Why we ask", "How this plan was built"). A real button with
// aria-expanded/aria-controls so it's keyboard operable; closes on Escape
// or an outside click/focus.
"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function InfoPopover({
  label,
  children,
  className,
  panelClassName,
  align = "start",
  side = "bottom",
  collisionPadding = 8,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  align?: "start" | "end";
  side?: "top" | "bottom";
  collisionPadding?: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedByHover = useRef(false);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = "";
    const rect = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    let shift = 0;
    if (rect.left < collisionPadding) {
      shift = collisionPadding - rect.left;
    }
    const right = rect.right + shift;
    if (right > viewportWidth - collisionPadding) {
      shift -= right - (viewportWidth - collisionPadding);
    }
    panel.style.transform = shift === 0 ? "" : `translateX(${Math.round(shift)}px)`;
  }, [open, collisionPadding, align, side]);

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
    <div
      ref={rootRef}
      className={cn("relative inline-flex", className)}
      // Desktop: open on hover. Touch keeps tap-to-toggle via the button.
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        openedByHover.current = true;
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        openedByHover.current = false;
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label ?? t("infoPopover.moreInfo")}
        onClick={() => {
          // A click right after hover-open pins it open instead of closing it.
          const pin = openedByHover.current;
          openedByHover.current = false;
          setOpen((current) => (pin ? true : !current));
        }}
        className="inline-flex items-center text-grey hover:text-ink"
      >
        <Info className="size-4" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="note"
          className={cn(
            "absolute z-20 w-[300px] max-w-[80vw] rounded-xl border border-line bg-white p-3 text-[13px] leading-relaxed text-grey shadow-md",
            side === "top" ? "bottom-full mb-2" : "top-6",
            align === "end" ? "right-0 left-auto" : "left-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
