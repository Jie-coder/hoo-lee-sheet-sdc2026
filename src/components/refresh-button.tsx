// Real trend refresh: POST /api/refresh-signals re-counts arXiv papers, then
// the page re-renders with the new snapshot. Shows loading and error states;
// on failure the last good snapshot stays on screen.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { ActiveSignals } from "@/lib/signals";
import { useT } from "@/lib/i18n";
import { clearRolesCache } from "@/lib/use-roles";

export type RefreshResult =
  | { ok: true; active: ActiveSignals; refreshed: string[]; skipped: string[] }
  | { ok: false; error: string };

export async function requestRefresh(fetchImpl: typeof fetch = fetch): Promise<RefreshResult> {
  try {
    const response = await fetchImpl("/api/refresh-signals", { method: "POST" });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.active) return { ok: false, error: body?.error ?? `HTTP ${response.status}.` };
    return { ok: true, active: body.active, refreshed: body.refreshed ?? [], skipped: body.skipped ?? [] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.message}.` : "Network error." };
  }
}

export function RefreshButton({ onRefreshed }: { onRefreshed?: (result: RefreshResult) => void }) {
  const { t } = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function onClick() {
    setLoading(true);
    setMessage({ tone: "info", text: t("trend.refreshing") });
    const result = await requestRefresh();
    setLoading(false);
    if (result.ok) {
      clearRolesCache();
      setMessage({
        tone: "info",
        text: t("trend.refreshDone", { count: String(result.refreshed.length), skipped: String(result.skipped.length) }),
      });
      startTransition(() => router.refresh());
    } else {
      setMessage({ tone: "error", text: t("trend.refreshError", { error: result.error }) });
    }
    onRefreshed?.(result);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        data-testid="trend-refresh"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-btn2 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap disabled:opacity-60"
      >
        <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} strokeWidth={1.6} />
        {loading ? t("refreshButton.loading") : t("refreshButton.label")}
      </button>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "max-w-[420px] text-[12px] text-signal-high" : "max-w-[420px] text-[12px] text-grey"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
