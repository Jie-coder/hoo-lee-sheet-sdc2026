// Source chip: dataset name, release date, and a link to the dataset.
import { Activity, Database } from "lucide-react";
import { formatSourceDate } from "@/lib/display";
import type { Source } from "@/types/contracts";

export function SourceChip({ source }: { source: Source }) {
  const dailySignal = /arxiv|momentum/i.test(source.dataset);
  const Icon = dailySignal ? Activity : Database;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-line bg-alt px-2 py-0.5 text-[11px] leading-4 text-grey"
    >
      <Icon className="size-3" strokeWidth={1.6} />
      {source.dataset} · {formatSourceDate(source.releaseDate)}
    </a>
  );
}
