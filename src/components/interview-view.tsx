// Interview: a scripted 5-turn slot-filling flow (section 03). Mostly tap
// chips; a hard cap of MAX_INTERVIEW_TURNS always sends the user to /results.
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { EASE_OUT, RouteLine, SPRING } from "@/components/motion";
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
  const reduce = useReducedMotion();
  const { hydrated, consent, profile, interviewAnswers, setInterviewAnswers, setCourseLanguages } = useFlow();

  const [turn, setTurn] = useState(1);
  const [direction, setDirection] = useState(1);
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

  function advance(merged: PartialSlots) {
    setSlots(merged);
    if (isInterviewDone(turn)) {
      setInterviewAnswers(finalizeSlots(merged));
      router.push("/results");
      return;
    }
    setDirection(1);
    setTurn((current) => current + 1);
  }

  function handleNext() {
    advance({ ...slots, ...answerForCurrentTurn() });
  }

  function handleSkip() {
    advance(slots);
  }

  function handleBack() {
    if (turn === 1) return;
    setDirection(-1);
    setTurn((current) => current - 1);
  }

  // Answers so far, as short chips under the card.
  const soFar: string[] = [
    activeProfile.roles[0]?.title ?? "",
    known.ageBand ? `Age ${known.ageBand}` : "",
    hours != null ? `${hours} h/week` : "",
    budget != null ? (budget === 0 ? "Free only" : `Up to RM${budget}`) : "",
    turn > 2 ? `${tasks.length} tasks weighted` : "",
    aiUsage ? AI_USAGE_CHIPS.find((chip) => chip.value === aiUsage)?.label ?? "" : "",
    employmentStatus ? EMPLOYMENT_STATUS_CHIPS.find((chip) => chip.value === employmentStatus)?.label.split(" (")[0] ?? "" : "",
    impactInterest ? IMPACT_INTEREST_CHIPS.find((chip) => chip.value === impactInterest)?.label ?? "" : "",
  ].filter(Boolean);

  const question = INTERVIEW_QUESTIONS[turn];
  const slide = {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 40 * dir }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -40 * dir }),
  };

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 sm:px-6">
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pt-10 pb-8"
      >
        <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">Five quick questions</h1>
        <p className="mt-2 text-[15px] text-grey">Only what the CV cannot tell us. Tap to answer.</p>
      </motion.section>

      {/* Progress: five stations on one line */}
      <div className="relative mb-6 h-6">
        <RouteLine
          d="M 0 1 H 1000"
          viewBox="0 0 1000 2"
          preserveAspectRatio="none"
          strokeWidth={2}
          delay={0}
          duration={0.6}
          progress={(turn - 1) / (MAX_INTERVIEW_TURNS - 1)}
          className="absolute top-[11px] right-[2px] left-[2px] h-[2px] w-[calc(100%-4px)]"
        />
        <ol className="absolute inset-x-0 top-0 flex justify-between" aria-label="Progress">
          {Array.from({ length: MAX_INTERVIEW_TURNS }, (_, index) => {
            const step = index + 1;
            const done = step < turn;
            const current = step === turn;
            return (
              <li key={step} aria-current={current ? "step" : undefined}>
                <motion.span
                  layout
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border-2 bg-paper text-[11px] tabular-nums",
                    done && "border-sage bg-sage text-paper",
                    current && "border-ink bg-ink text-paper",
                    !done && !current && "border-line text-grey",
                  )}
                  animate={{ scale: current ? 1.15 : 1 }}
                  transition={SPRING}
                >
                  {done ? <Check className="size-3" strokeWidth={2.6} /> : step}
                </motion.span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="panel overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={turn}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="p-6 sm:p-8"
          >
            <p className="text-[12px] text-grey">
              Question <span className="tabular-nums">{turn}</span> of <span className="tabular-nums">{MAX_INTERVIEW_TURNS}</span>
            </p>
            <h2 className="mt-2 font-serif text-[24px] leading-snug font-medium text-balance sm:text-[28px]">{question.title}</h2>
            {question.subtitle && <p className="mt-1.5 text-[14px] text-grey">{question.subtitle}</p>}

            <div className="mt-6">
              {turn === 1 && (
                <div className="flex flex-col gap-5">
                  <ChipRow label="Hours a week">
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
                <div>
                  <ul className="divide-y divide-line">
                    {tasks.map((task, index) => (
                      <li key={`${task}-${index}`} className="py-3">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                          <span className="text-[14px]">{task}</span>
                          <div className="flex items-center gap-1.5 tabular-nums">
                            {TASK_SHARE_CHIPS.map((chip) => (
                              <Chip
                                key={chip.label}
                                compact
                                selected={taskShares[index] === chip.value}
                                onClick={() =>
                                  setTaskShares((current) => current.map((value, i) => (i === index ? chip.value : value)))
                                }
                              >
                                {chip.label}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-alt">
                            <motion.div
                              className="h-1 rounded-full bg-sage"
                              animate={{ width: `${Math.round((taskShares[index] ?? 0) * 200)}%` }}
                              transition={SPRING}
                            />
                          </div>
                          <span className="w-10 text-right text-[12px] tabular-nums text-grey">
                            {Math.round((taskShares[index] ?? 0) * 100)}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-3 text-[13px]">
                    <button type="button" onClick={() => setTaskShares(splitTaskSharesEvenly(tasks.length))} className="text-grey underline-offset-4 hover:text-ink hover:underline">
                      Split evenly
                    </button>
                    <span className="text-grey">
                      Total <span className="font-medium text-ink tabular-nums">{percentTotal}%</span>
                    </span>
                  </div>
                </div>
              )}

              {turn === 3 && (
                <div className="flex flex-col gap-5">
                  <label className="block text-[12px] text-grey">
                    Tools you use, comma separated
                    <input
                      value={tools}
                      onChange={(event) => setTools(event.target.value)}
                      placeholder="Excel, WhatsApp Business, Canva"
                      className="field mt-1.5"
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
                <div className="flex flex-col gap-5">
                  <ChipRow label="Work status">
                    {EMPLOYMENT_STATUS_CHIPS.map((chip) => (
                      <Chip key={chip.value} selected={employmentStatus === chip.value} onClick={() => setEmploymentStatus(chip.value)}>
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
                <div className="flex flex-col gap-5">
                  <ChipRow label="A cause you care about">
                    {IMPACT_INTEREST_CHIPS.map((chip) => (
                      <Chip key={chip.value} selected={impactInterest === chip.value} onClick={() => setImpactInterest(chip.value)}>
                        {chip.label}
                      </Chip>
                    ))}
                  </ChipRow>
                  <ChipRow label="Course language for your pathway">
                    {STUDY_LANGUAGES.map((language) => (
                      <Chip
                        key={language.value}
                        selected={studyLanguage === language.value}
                        onClick={() => setCourseLanguages([language.value])}
                      >
                        {language.label}
                      </Chip>
                    ))}
                  </ChipRow>
                </div>
              )}
            </div>

            <p className="mt-6 text-[12px] text-grey">Why we ask: {question.why}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
          <button type="button" data-testid="interview-back" onClick={handleBack} disabled={turn === 1} className="btn-ghost -ml-3">
            Back
          </button>
          <div className="flex items-center gap-2">
            <button type="button" data-testid="interview-skip" onClick={handleSkip} className="btn-ghost">
              Skip
            </button>
            <button type="button" data-testid="interview-next" onClick={handleNext} className="btn-primary">
              {isInterviewDone(turn) ? "See results" : "Next"}
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {/* So far */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[12px] text-grey">
        <span className="mr-1">So far:</span>
        <AnimatePresence initial={false}>
          {soFar.map((item) => (
            <motion.span
              key={item}
              layout
              initial={reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.8 }}
              transition={SPRING}
              className="tag bg-white ring-1 ring-line"
            >
              {item}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] text-grey">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
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
    <button type="button" aria-pressed={selected} onClick={onClick} className={cn("chip", compact && "chip-sm")}>
      {children}
    </button>
  );
}
