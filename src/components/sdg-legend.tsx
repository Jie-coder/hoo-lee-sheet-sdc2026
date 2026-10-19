// Legend for the three SDG tiers. Shown beside the first role-card row.
export function SdgLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-grey">
      <span>SDG target links:</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded bg-sage" />
        Direct
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded border border-sage" />
        Supporting
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded border border-dashed border-sage" />
        AI-suggested
      </span>
    </div>
  );
}
