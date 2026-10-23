// AI Exposure intro (design exposure-intro-v3): heading, intro line, then three
// alternating card + illustration rows. Illustrations are static SVGs in public/exposure.
"use client";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n-messages";

const ROWS: ReadonlyArray<{
  n: 1 | 2 | 3;
  panel: "violet" | "ember";
  mirrored: boolean;
}> = [
  { n: 1, panel: "violet", mirrored: false },
  { n: 2, panel: "ember", mirrored: true },
  { n: 3, panel: "violet", mirrored: false },
];

export function ExposureIntro({ measuredHref = "#how-measured" }: { measuredHref?: string }) {
  const { t } = useT();
  return (
    <section className="mx-auto w-full max-w-6xl min-w-0 px-5 pt-24 md:pt-20" aria-labelledby="exposure-intro-heading">
      <div className="mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
        <h2
          id="exposure-intro-heading"
          className="min-w-0 font-heading text-[44px] leading-[0.92] break-words uppercase md:max-w-[620px] md:text-[clamp(56px,6.5vw,88px)]"
        >
          {t("exposureIntro.heading")}
        </h2>
        <p className="text-[17px] md:max-w-[400px] md:shrink-0 md:text-[20px]">{t("exposureIntro.lede")}</p>
      </div>
      <div className="flex flex-col gap-4">
        {ROWS.map(({ n, panel, mirrored }) => (
          <div
            key={n}
            className={`flex flex-col gap-4 md:h-[520px] ${mirrored ? "md:flex-row-reverse" : "md:flex-row"}`}
          >
            <div className="flex flex-col justify-between gap-8 rounded-[40px] bg-[#f7f6f2] p-8 md:w-[44%] md:shrink-0 md:p-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative icon */}
              <img src={`/exposure/ic${n}.svg`} alt="" aria-hidden className="size-[72px] rounded-[18px] bg-[#070607] p-3" />
              <div>
                <p className="mb-3.5 font-mono text-[12px] tracking-[0.08em] text-[#6b6b66] uppercase">
                  {t(`exposureIntro.step${n}.label` as MessageKey)}
                </p>
                <h3 className="mb-4 font-sans text-[26px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance md:text-[28px]">
                  {t(`exposureIntro.step${n}.title` as MessageKey)}
                </h3>
                <p className="text-[#3a3a3a]">{t(`exposureIntro.step${n}.body` as MessageKey)}</p>
                {n === 3 && (
                  <a
                    href={measuredHref}
                    className="mt-6 inline-flex h-12 items-center gap-2.5 rounded-full border-[1.5px] border-[#070607] px-[22px] text-[16px] font-bold text-[#070607] hover:bg-[#070607] hover:text-[#f7f6f2]"
                  >
                    {t("exposureIntro.measuredCta")} <span aria-hidden className="text-[12px]">▶</span>
                  </a>
                )}
              </div>
            </div>
            <div
              className={`aspect-[820/520] overflow-hidden rounded-[40px] md:aspect-auto md:min-w-0 md:flex-1 ${panel === "ember" ? "bg-sage" : "bg-[#524ae9]"}`}
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative illustration */}
              <img src={`/exposure/u${n}.svg`} alt="" className="size-full object-cover" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
