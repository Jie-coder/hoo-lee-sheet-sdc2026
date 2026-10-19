// Re-reads the current mock snapshot. The stamp is the last successful read.
"use client";

import { RefreshCw } from "lucide-react";

export function RefreshButton({
  refreshedLabel,
  loading,
  onRefresh,
}: {
  refreshedLabel: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] whitespace-nowrap text-grey">Last refreshed {refreshedLabel}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-btn2 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap disabled:opacity-60"
      >
        <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} strokeWidth={1.6} />
        Refresh
      </button>
    </div>
  );
}
