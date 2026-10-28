// Scales the arXiv trend momentum behind each skill. Display updates on every
// drag step, but onChange is debounced so the results request is not spammed.
"use client";

import { useEffect, useRef, useState } from "react";
import { ADOPTION_SPEED } from "@/lib/adoption";
import { useT } from "@/lib/i18n";

const DEBOUNCE_MS = 250;

export function AdoptionSpeedSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (speed: number) => void;
}) {
  const { t } = useT();
  const [display, setDisplay] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror external prop changes (e.g. a reset)
    setDisplay(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleChange(next: number) {
    setDisplay(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
  }

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor="adoption-speed"
          className="font-mono text-[12px] tracking-[0.06em] text-grey/70 uppercase"
        >
          {t("adoption.label")}
        </label>
        <span className="font-mono text-[12px] tracking-[0.06em] text-ink uppercase" aria-hidden="true">
          {t("adoption.value", { speed: String(display) })}
        </span>
      </div>
      <input
        id="adoption-speed"
        type="range"
        min={ADOPTION_SPEED.min}
        max={ADOPTION_SPEED.max}
        step={ADOPTION_SPEED.step}
        value={display}
        onChange={(event) => handleChange(Number(event.target.value))}
        aria-valuetext={t("adoption.value", { speed: String(display) })}
        className="mt-2 w-full accent-sage"
      />
      <div className="mt-1 flex justify-between font-mono text-[12px] tracking-[0.06em] text-grey/70 uppercase">
        <span>{t("adoption.slower")}</span>
        <span>{t("adoption.faster")}</span>
      </div>
      <p className="mt-1 font-mono text-[12px] tracking-[0.06em] text-grey/70">{t("adoption.hint")}</p>
    </div>
  );
}
