// The trend source line: name (arXiv API), fetch date and time, whether it
// is a live snapshot or the bundled one, and the Refresh button.
"use client";

import { RefreshButton } from "@/components/refresh-button";
import { formatDayMonthYear } from "@/lib/display";
import { fetchedParts } from "@/lib/format-fetched";
import { useT } from "@/lib/i18n";
import type { TrendInfo } from "@/lib/trend-info";

export type { TrendInfo };

export function TrendStatus({ info, className }: { info: TrendInfo; className?: string }) {
  const { t } = useT();
  const { date, time } = fetchedParts(info.fetchedAt, t);
  const storeLabel = t(info.store === "supabase" ? "trend.storeSupabase" : "trend.storeLocal");
  const originLabel =
    info.source === "live"
      ? `${t("trend.live")} · ${storeLabel}`
      : info.source === "last-good"
        ? `${t("trend.lastGood")} · ${storeLabel}`
        : t("trend.bundled");
  return (
    <section
      aria-label={t("trend.sourceLine", { source: info.provider })}
      data-testid="trend-status"
      className={`flex flex-col gap-3 rounded-[24px] border border-line bg-card p-5 sm:flex-row sm:items-start sm:justify-between ${className ?? ""}`}
    >
      <div className="space-y-1">
        <p className="font-mono text-[12px] tracking-[0.06em] uppercase">
          {t("trend.sourceLine", { source: info.provider })} ·{" "}
          {info.source === "bundled" ? date : t("trend.fetched", { date, time })}
        </p>
        <p className="text-[13px] text-grey">
          <span data-testid="trend-origin" data-source={info.source}>{originLabel}</span>
          {info.source !== "bundled" && (
            <>
              {" · "}
              <span data-testid="trend-recounted">
                {info.carriedFrom
                  ? t("trend.refreshedPartial", {
                      count: String(info.refreshedCount),
                      total: String(info.total),
                      date: formatDayMonthYear(info.carriedFrom, t),
                    })
                  : t("trend.refreshedCount", { count: String(info.refreshedCount), total: String(info.total) })}
              </span>
            </>
          )}
        </p>
        {info.warning && <p className="text-[12px] text-signal-high">{t("trend.fallback")}</p>}
      </div>
      <RefreshButton locked={info.refreshLocked} />
    </section>
  );
}
