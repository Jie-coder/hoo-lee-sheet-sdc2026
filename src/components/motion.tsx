// Small motion helpers shared by every screen: a scroll reveal, a staggered
// list, a counting number, and the "laluan" route line that draws itself.
// All of them collapse to static output under prefers-reduced-motion.
"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, type Transition } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 34 };

/** Fades and lifts its children in once they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Children appear one after another. Pair with <StaggerItem>. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.07,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Counts from 0 to `value` when it enters the viewport. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  className,
  duration = 1.1,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const mv = useMotionValue(0);
  const [text, setText] = useState(() => (0).toFixed(decimals));

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(mv, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (latest) => setText(latest.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [inView, value, decimals, duration, reduce, mv]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {reduce ? value.toFixed(decimals) : text}
      {suffix}
    </span>
  );
}

/**
 * The laluan: an SVG path that draws itself from start to end, in the accent
 * colour over a faint full-length guide. `progress` (0..1) draws part of it.
 */
export function RouteLine({
  d,
  viewBox,
  className,
  strokeWidth = 2.5,
  delay = 0.2,
  duration = 1.6,
  progress,
  preserveAspectRatio,
  children,
}: {
  d: string;
  viewBox: string;
  className?: string;
  strokeWidth?: number;
  delay?: number;
  duration?: number;
  progress?: number;
  preserveAspectRatio?: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const target = progress ?? 1;
  const controlled = progress !== undefined;
  return (
    <svg viewBox={viewBox} fill="none" className={className} preserveAspectRatio={preserveAspectRatio} aria-hidden>
      <path d={d} stroke="var(--color-line)" strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <motion.path
        d={d}
        stroke="var(--color-sage)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? { pathLength: target } : { pathLength: 0 }}
        {...(controlled
          ? { animate: { pathLength: target } }
          : { whileInView: { pathLength: target }, viewport: { once: true, amount: 0.3 } })}
        transition={{ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: EASE_OUT }}
      />
      {children}
    </svg>
  );
}

/** A station on the route that pops in once the line has reached it. */
export function RouteDot({
  cx,
  cy,
  r = 5,
  delay = 0,
  filled = true,
}: {
  cx: number;
  cy: number;
  r?: number;
  delay?: number;
  filled?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      fill={filled ? "var(--color-sage)" : "var(--color-paper)"}
      stroke="var(--color-sage)"
      strokeWidth={2}
      initial={reduce ? false : { scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ ...SPRING, delay }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

/** Lifts a block in on mount and drops it out on unmount (use inside AnimatePresence). */
export function SlideIn({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -12, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
