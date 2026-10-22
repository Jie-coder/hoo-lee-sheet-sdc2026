// Fixed line on results and pathway: scores are estimates, not decisions.
import { Scale } from "lucide-react";

export function EstimateFooter() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1248px] flex-col gap-1 px-4 py-2 text-[12px] text-grey sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 sm:items-center">
          <Scale className="mt-0.5 size-3.5 shrink-0 sm:mt-0" strokeWidth={1.6} />
          All scores and forecasts are estimates. Laluan supports your decision; it does not make hiring decisions.
        </p>
        <span className="self-end rounded border border-line px-1.5 py-0.5 text-[11px] whitespace-nowrap sm:self-auto">
          Public data · synthetic sample profiles
        </span>
      </div>
    </footer>
  );
}
