// Current-work card: the AI exposure of the user's current job, from the
// ILO GenAI exposure study. "Exposure is not job loss." always stays visible.
// Augmentation is not shown: there is no task-level augmentation data yet.
import { InfoPopover } from "@/components/ui/info-popover";
import { SourcesDisclosure } from "@/components/sources-disclosure";
import { formatBandScoreParts } from "@/lib/display";
import type { Source } from "@/types/contracts";

export type CurrentWork = {
  title: string;
  exposure: number;
  /** ISCO-08 has no code for this exact job, so the figure is for a wider occupation group. */
  groupEstimate: boolean;
  sources: Source[];
};

export function ScoreCard({ currentWork }: { currentWork: CurrentWork }) {
  const exposure = formatBandScoreParts(currentWork.exposure);
  const exposurePercent = Math.round(currentWork.exposure * 100);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:flex lg:items-start lg:gap-10">
      <div className="lg:w-[420px] lg:shrink-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">AI EXPOSURE OF YOUR CURRENT JOB</p>
          <InfoPopover label="What AI exposure means">
            The share of a job&rsquo;s tasks that generative AI could perform or assist with, scored 0 to 1 by the ILO
            from task descriptions. It describes the job, not you.
          </InfoPopover>
        </div>
        <p className="mt-3 font-serif text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-[56px]">
          {exposure.band} <span className="text-grey/40">·</span> {exposure.value}
        </p>
        <p className="mt-3 text-[14px] font-medium text-ink">Exposure is not job loss.</p>
        <div className="mt-3">
          <div className="relative flex h-1.5">
            <div className="flex-1 rounded-l-full bg-alt" />
            <div className="mx-0.5 flex-1 bg-line" />
            <div className="flex-1 rounded-r-full bg-alt" />
            <span
              className="absolute -top-[3px] size-3 rounded-full bg-ink ring-2 ring-white"
              style={{ left: `clamp(0px, calc(${exposurePercent}% - 6px), calc(100% - 12px))` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-grey">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>
      </div>
      <div className="mt-5 text-[14px] leading-relaxed text-grey lg:mt-0 lg:flex-1">
        <p>
          Figure for <span className="font-medium text-ink capitalize">{currentWork.title}</span>
          {currentWork.groupEstimate ? ", using the closest ILO occupation group (no exact code exists)." : "."}
        </p>
        <p className="mt-2">
          Medium or high exposure usually means parts of the job change, so the roles below favour work where your
          skills carry over and AI exposure is lower.
        </p>
        <div className="mt-4">
          <SourcesDisclosure sources={currentWork.sources} />
        </div>
      </div>
    </section>
  );
}
