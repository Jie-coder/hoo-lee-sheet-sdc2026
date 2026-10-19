// Current-work scores: augmentation is the hero, exposure sits beside it.
import { SourceChip } from "@/components/source-chip";
import { formatBandScoreParts } from "@/lib/display";
import type { CurrentWorkScores, UnitScore } from "@/types/contracts";

export type TaskAugmentation = {
  label: string;
  augmentation: UnitScore;
};

export function ScoreCard({
  currentWork,
  tasks,
}: {
  currentWork: CurrentWorkScores;
  tasks: readonly TaskAugmentation[];
}) {
  const augmentation = formatBandScoreParts(currentWork.augmentation);
  const exposure = formatBandScoreParts(currentWork.exposure);
  const exposurePercent = Math.round(currentWork.exposure * 100);
  const augmentationSources = currentWork.sources.slice(0, 1);

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:col-span-7 lg:flex lg:gap-8">
        <div className="flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">AUGMENTATION</p>
          <p className="mt-3 font-serif text-5xl leading-none font-medium tracking-tight text-sage tabular-nums sm:text-[56px]">
            {augmentation.band} <span className="text-sage-tint">·</span> {augmentation.value}
          </p>
          <p className="mt-3 max-w-[360px] text-[14px] leading-relaxed text-grey">
            How much AI tools can make your current tasks faster and better, with you still in charge.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {augmentationSources.map((source) => (
              <SourceChip key={source.url} source={source} />
            ))}
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-5 lg:mt-0 lg:w-[270px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <p className="mb-2.5 text-[12px] text-grey">Your tasks, by augmentation</p>
          <ul className="space-y-2.5 text-[13px]">
            {tasks.map((task) => (
              <li key={task.label}>
                <div className="flex justify-between gap-3">
                  <span>{task.label}</span>
                  <span className="text-grey tabular-nums">{task.augmentation.toFixed(2)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-alt">
                  <div
                    className={task.augmentation > 0.66 ? "h-1.5 rounded-full bg-sage" : "h-1.5 rounded-full bg-sage/70"}
                    style={{ width: `${Math.round(task.augmentation * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-line bg-white p-5 sm:p-6 lg:col-span-5">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">AI EXPOSURE</p>
        <p className="mt-3 font-serif text-[40px] leading-none font-medium tracking-tight tabular-nums">
          {exposure.band} <span className="text-grey/40">·</span> {exposure.value}
        </p>
        <p className="mt-3 text-[14px] font-medium text-ink">Exposure is not job loss.</p>
        <p className="text-[13px] leading-relaxed text-grey">
          How much of your current tasks AI tools can perform or assist with.
        </p>
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
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          {currentWork.sources.map((source) => (
            <SourceChip key={`${source.dataset}-${source.releaseDate}`} source={source} />
          ))}
        </div>
      </div>
    </section>
  );
}
