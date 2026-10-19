// Interview: a scripted 5-turn slot-filling chat (section 03). Mostly tap
// chips; a hard cap of MAX_INTERVIEW_TURNS always sends the user to /results.
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleCheck, Info, Pencil, ScanText, Timer } from "lucide-react";
import { useFlow } from "@/context/flow-context";
import {
  AI_USAGE_CHIPS,
  BUDGET_CHIPS,
  EMPLOYMENT_STATUS_CHIPS,
  HOURS_PER_WEEK_CHIPS,
  IMPACT_INTEREST_CHIPS,
  INTERVIEW_QUESTIONS,
  PERKESO_CHIPS,
  TASK_SHARE_CHIPS,
  isInterviewDone,
  normalizeTaskShares,
  splitTaskSharesEvenly,
} from "@/lib/interview";
import { personaKnownSlots } from "@/lib/persona-slots";
import { cn } from "@/lib/utils";
import { MAX_INTERVIEW_TURNS, type LanguageCode, type PartialSlots } from "@/types/contracts";

const STUDY_LANGUAGES: ReadonlyArray<{ value: LanguageCode; label: string }> = [
  { value: "en", label: "EN" },
  { value: "ms", label: "BM" },
  { value: "zh", label: "中文" },
];

export function InterviewView() {
  const router = useRouter();
  const { hydrated, consent, profile, interviewAnswers, setInterviewAnswers, setCourseLanguages } = useFlow();

  const [turn, setTurn] = useState(1);
  const [slots, setSlots] = useState<PartialSlots>(interviewAnswers);

  const [hours, setHours] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);

  const tasks = useMemo(() => {
    const fromCv = profile?.roles.flatMap((role) => role.tasks) ?? [];
    return fromCv.slice(0, 5).length > 0 ? fromCv.slice(0, 5) : ["Main task", "Secondary task"];
  }, [profile]);
  const [taskShares, setTaskShares] = useState<number[]>(() => splitTaskSharesEvenly(tasks.length));

  const [tools, setTools] = useState("");
  const [aiUsage, setAiUsage] = useState<PartialSlots["ai_usage"]>(undefined);
  const [employmentStatus, setEmploymentStatus] = useState<PartialSlots["employment_status"]>(undefined);
  const [perkeso, setPerkeso] = useState<boolean | undefined>(undefined);
  const [impactInterest, setImpactInterest] = useState<PartialSlots["impact_interest"]>(undefined);

  useEffect(() => {
    if (!hydrated) return;
    if (!consent) {
      router.replace("/");
      return;
    }
    if (!profile) router.replace("/profile");
  }, [hydrated, consent, profile, router]);

  if (!profile) return null;
  const activeProfile = profile;

  const known = personaKnownSlots(activeProfile.personaId);
  const studyLanguage = activeProfile.courseLanguages[0] ?? "en";
  const percentTotal = Math.round(taskShares.reduce((sum, value) => sum + value, 0) * 100);

  function answerForCurrentTurn(): PartialSlots {
    switch (turn) {
      case 1:
        return {
          ...(hours != null ? { hours_per_week: hours } : {}),
          ...(budget != null ? { budget } : {}),
        };
      case 2:
        return {
          tasks: tasks.map((text, index) => ({ text, share: normalizeTaskShares(taskShares)[index] })),
        };
      case 3: {
        const toolList = tools
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        return {
          ...(toolList.length ? { tools: toolList } : {}),
          ...(aiUsage ? { ai_usage: aiUsage } : {}),
        };
      }
      case 4:
        return {
          ...(employmentStatus ? { employment_status: employmentStatus } : {}),
          ...(perkeso !== undefined ? { perkeso_contributor: perkeso } : {}),
        };
      case 5:
        return impactInterest ? { impact_interest: impactInterest } : {};
      default:
        return {};
    }
  }

  function finalizeSlots(merged: PartialSlots): PartialSlots {
    return {
      ...merged,
      ...(known.ageBand ? { age_band: known.ageBand } : {}),
      ...(known.state ? { state: known.state } : {}),
      languages: activeProfile.courseLanguages,
    };
  }

  function handleAdvance() {
    const merged = { ...slots, ...answerForCurrentTurn() };
    setSlots(merged);
    if (isInterviewDone(turn)) {
      setInterviewAnswers(finalizeSlots(merged));
      router.push("/results");
      return;
    }
    setTurn((current) => current + 1);
  }

  const questionsLeft = MAX_INTERVIEW_TURNS - turn + 1;
  const minutesLeft = Math.max(1, Math.ceil(questionsLeft * 0.4));

  return (
    <main className="mx-auto max-w-[1248px] px-4 pb-12 sm:px-6">
      <section className="flex flex-col gap-3 pt-7 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[13px] text-grey">
            {profile.name || "Your profile"} · {profile.roles[0]?.title ?? "No role yet"}
          </p>
          <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-medium tracking-tight md:text-[36px]">
            A few quick questions
          </h1>
        </div>
        <p className="text-[13px] leading-relaxed text-grey md:max-w-[400px] md:text-right">
          We only ask what your CV can&rsquo;t tell us. Tap a chip, or type if you prefer. Five questions at most.
        </p>
      </section>

      <section className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
        {/* Chat panel */}
        <div className="flex flex-col rounded-2xl border border-line bg-white md:col-span-8">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-medium">
                Question <span className="tabular-nums">{turn}</span> of{" "}
                <span className="tabular-nums">{MAX_INTERVIEW_TURNS}</span>
              </p>
              <div
                className="flex items-center gap-1.5"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={MAX_INTERVIEW_TURNS}
                aria-valuenow={turn}
              >
                {Array.from({ length: MAX_INTERVIEW_TURNS }, (_, index) => {
                  const step = index + 1;
                  return (
                    <span
                      key={step}
                      className={cn(
                        "h-2 rounded-full",
                        step < turn ? "w-2 bg-sage" : step === turn ? "w-5 bg-ink" : "w-2 bg-line",
                      )}
                    />
                  );
                })}
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[12px] text-grey">
              <Timer className="size-3.5" strokeWidth={1.6} />
              About {minutesLeft} min left
            </span>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
                <ScanText className="size-3.5" strokeWidth={1.6} />
              </span>
              <div className="max-w-[560px] flex-1 rounded-2xl rounded-tl-md bg-alt px-4 py-3 text-[14px] leading-relaxed">
                <p className="font-medium">{INTERVIEW_QUESTIONS[turn].title}</p>
                {INTERVIEW_QUESTIONS[turn].subtitle && (
                  <p className="mt-0.5 text-[13px] text-grey">{INTERVIEW_QUESTIONS[turn].subtitle}</p>
                )}

                <div className="mt-3">
                  {turn === 1 && (
                    <div className="flex flex-col gap-3">
                      <ChipRow label="Hours per week">
                        {HOURS_PER_WEEK_CHIPS.map((value) => (
                          <Chip key={value} selected={hours === value} onClick={() => setHours(value)}>
                            {value} h
                          </Chip>
                        ))}
                      </ChipRow>
                      <ChipRow label="Budget for courses">
                        {BUDGET_CHIPS.map((chip) => (
                          <Chip key={chip.label} selected={budget === chip.value} onClick={() => setBudget(chip.value)}>
                            {chip.label}
                          </Chip>
                        ))}
                      </ChipRow>
                    </div>
                  )}

                  {turn === 2 && (
                    <div className="rounded-xl border border-line px-4">
                      <ul className="divide-y divide-line">
                        {tasks.map((task, index) => (
                          <li key={`${task}-${index}`} className="py-3">
                            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                              <span className="text-[14px]">{task}</span>
                              <div className="flex items-center gap-1.5 text-[12px] tabular-nums">
                                {TASK_SHARE_CHIPS.map((chip) => (
                                  <Chip
                                    key={chip.label}
                                    compact
                                    selected={taskShares[index] === chip.value}
                                    onClick={() =>
                                      setTaskShares((current) =>
                                        current.map((value, i) => (i === index ? chip.value : value)),
                                      )
                                    }
                                  >
                                    {chip.label}
                                  </Chip>
                                ))}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="h-1.5 flex-1 rounded-full bg-alt">
                                <div
                                  className="h-1.5 rounded-full bg-sage"
                                  style={{ width: `${Math.round((taskShares[index] ?? 0) * 200)}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-[13px] tabular-nums text-grey">
                                {Math.round((taskShares[index] ?? 0) * 100)}%
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <button
                          type="button"
                          onClick={() => setTaskShares(splitTaskSharesEvenly(tasks.length))}
                          className="rounded-md border border-line px-2.5 py-1 text-[13px] text-grey"
                        >
                          Split them evenly
                        </button>
                        <p className="flex items-center gap-1.5 text-[13px]">
                          <CircleCheck className="size-4 text-sage" strokeWidth={1.6} />
                          Total <span className="font-medium tabular-nums">{percentTotal}%</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {turn === 3 && (
                    <div className="flex flex-col gap-3">
                      <label className="block text-[13px]">
                        Tools you use (comma separated)
                        <input
                          value={tools}
                          onChange={(event) => setTools(event.target.value)}
                          placeholder="Excel, WhatsApp Business, Canva"
                          className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[14px]"
                        />
                      </label>
                      <ChipRow label="How much have you used AI tools?">
                        {AI_USAGE_CHIPS.map((chip) => (
                          <Chip key={chip.value} selected={aiUsage === chip.value} onClick={() => setAiUsage(chip.value)}>
                            {chip.label}
                          </Chip>
                        ))}
                      </ChipRow>
                    </div>
                  )}

                  {turn === 4 && (
                    <div className="flex flex-col gap-3">
                      <ChipRow label="Work status">
                        {EMPLOYMENT_STATUS_CHIPS.map((chip) => (
                          <Chip
                            key={chip.value}
                            selected={employmentStatus === chip.value}
                            onClick={() => setEmploymentStatus(chip.value)}
                          >
                            {chip.label}
                          </Chip>
                        ))}
                      </ChipRow>
                      <ChipRow label="Registered with PERKESO?">
                        {PERKESO_CHIPS.map((chip) => (
                          <Chip key={chip.label} selected={perkeso === chip.value} onClick={() => setPerkeso(chip.value)}>
                            {chip.label}
                          </Chip>
                        ))}
                      </ChipRow>
                    </div>
                  )}

                  {turn === 5 && (
                    <ChipRow label="Impact you care about">
                      {IMPACT_INTEREST_CHIPS.map((chip) => (
                        <Chip
                          key={chip.value}
                          selected={impactInterest === chip.value}
                          onClick={() => setImpactInterest(chip.value)}
                        >
                          {chip.label}
                        </Chip>
                      ))}
                    </ChipRow>
                  )}
                </div>
              </div>
            </div>
            <p className="flex items-start gap-1.5 pl-10 text-[12px] text-grey">
              <Info className="mt-px size-3.5 shrink-0 text-sage" strokeWidth={1.6} />
              Why we ask: {INTERVIEW_QUESTIONS[turn].why}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-3 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                if (isInterviewDone(turn)) {
                  setInterviewAnswers(finalizeSlots(slots));
                  router.push("/results");
                  return;
                }
                setTurn((current) => current + 1);
              }}
              className="rounded-lg border border-line bg-btn2 px-4 py-2.5 text-[14px] font-medium"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleAdvance}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-5 py-2.5 text-[14px] font-medium text-white"
            >
              {isInterviewDone(turn) ? "Finish" : "Next question"}
              <ArrowRight className="size-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* What we know so far */}
        <aside className="rounded-2xl border border-line bg-white p-6 md:col-span-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">STUDY LANGUAGE FOR YOUR PATHWAY</p>
          <div className="mt-2 flex items-center gap-0.5 rounded-full border border-line bg-white p-0.5 text-[12px]">
            {STUDY_LANGUAGES.map((language) => {
              const selected = studyLanguage === language.value;
              return (
                <button
                  key={language.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCourseLanguages([language.value])}
                  className={cn(
                    "flex-1 rounded-full px-2.5 py-1",
                    selected ? "bg-ink font-medium text-white" : "text-grey",
                  )}
                >
                  {language.label}
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-[11px] font-semibold tracking-[0.12em] text-grey">WHAT WE KNOW SO FAR</p>
          <ul className="mt-3 divide-y divide-line text-[13px]">
            <KnownRow done label="Current role" note="From CV" value={profile.roles[0]?.title ?? "—"} />
            <KnownRow
              done={Boolean(profile.personaId !== "upload")}
              label="Age band"
              note="From CV"
              value={known.ageBand ?? "Unknown"}
            />
            <KnownRow done label="Course languages" note="From CV · you confirmed" value={profile.courseLanguages.join(", ").toUpperCase()} />
            <KnownRow done={hours != null} current={turn === 1} label="Hours per week" note="Question 1" value={hours != null ? `${hours} h` : "Asked next"} />
            <KnownRow done={budget != null} current={turn === 1} label="Budget" note="Question 1" value={budget != null ? (budget === 0 ? "Free only" : `Up to RM${budget}`) : "Asked next"} />
            <KnownRow done={turn > 2} current={turn === 2} label="Tasks and time share" note="Question 2" value={`${tasks.length} tasks · ${percentTotal}%`} />
            <KnownRow done={turn > 3} current={turn === 3} label="Tools and AI use" note="Question 3" value={aiUsage ?? "Asked next"} />
            <KnownRow done={turn > 4} current={turn === 4} label="Work status · PERKESO" note="Question 4" value={employmentStatus ?? "Asked next"} />
            <KnownRow done={turn > 5} current={turn === 5} label="Impact you care about" note="Question 5" value={impactInterest ?? "Asked next"} />
          </ul>
        </aside>
      </section>

      <p className="mt-8 mb-6 border-t border-line pt-4 text-[11px] leading-relaxed text-grey/80">
        Example data: the questions, answers, task shares and filled slots on this page are illustrative example
        data (SDC Hackathon demo). They are not real measurements.
      </p>
    </main>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-grey">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  selected,
  compact,
  onClick,
  children,
}: {
  selected: boolean;
  compact?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[13px]",
        compact && "px-2 py-1 text-[12px]",
        selected ? "border-ink bg-ink font-medium text-white" : "border-line bg-white text-grey",
      )}
    >
      {children}
    </button>
  );
}

function KnownRow({
  done,
  current,
  label,
  note,
  value,
}: {
  done: boolean;
  current?: boolean;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            done ? "bg-sage-soft text-sage" : current ? "bg-ink text-white" : "border border-line",
          )}
        >
          {done ? <Check className="size-3" strokeWidth={1.6} /> : current ? <Pencil className="size-3" strokeWidth={1.6} /> : null}
        </span>
        <span>
          <span className="block text-ink">{label}</span>
          <span className="block text-[11px] text-grey">{note}</span>
        </span>
      </span>
      <span className={cn("text-right", done || current ? "text-ink" : "text-grey/80")}>{value}</span>
    </li>
  );
}
