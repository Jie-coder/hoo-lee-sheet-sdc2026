// Fixed line on results and pathway: scores are estimates, not decisions.
import { Scale } from "lucide-react";

export function EstimateFooter() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1248px] items-center justify-between gap-4 px-4 py-2.5 text-[12px] text-grey sm:px-6">
        <p className="flex items-start gap-2 sm:items-center">
          <Scale className="mt-0.5 size-3.5 shrink-0 sm:mt-0" strokeWidth={1.6} />
          All scores are estimates. Laluan supports your decision; it does not make hiring decisions.
        </p>
        <span className="tag hidden whitespace-nowrap sm:inline-flex">Public data, synthetic profiles</span>
      </div>
    </footer>
  );
}
