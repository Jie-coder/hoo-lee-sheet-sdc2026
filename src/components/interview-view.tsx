// Interview: a scripted 5-turn slot-filling flow (section 03). Mostly tap
// chips; a hard cap of MAX_INTERVIEW_TURNS always sends the user to /results.
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { EASE_OUT, RouteLine, SPRING } from "@/components/motion";
import { PageHero } from "@/components/caldera";
import { useFlow } from "@/context/flow-context";
import {
  AI_USAGE_CHIPS,
  BUDGET_CHIPS,
  EMPLOYMENT_STATUS_CHIPS,
  HOURS_PER_WEEK_CHIPS,
  IMPACT_INTEREST_CHIPS,
  INTERVIEW_QUESTIONS,
  PERKESO_CHIPS,
  TASK_WEIGHT_LEVELS,
  TOOL_CHIPS,
  isInterviewDone,
  taskSharesFromLevels,
  levelsAfterMainTaskMove,
} from "@/lib/interview";
import { personaKnownSlots } from "@/lib/persona-slots";
import { useT, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MAX_INTERVIEW_TURNS, type LanguageCode, type PartialSlots } from "@/types/contracts";

const STUDY_LANGUAGES: ReadonlyArray<{ value: LanguageCode; labelKey: MessageKey }> = [
  { value: "en", labelKey: "interview.languageEn" },
  { value: "ms", labelKey: "interview.languageMs" },
  { value: "zh", labelKey: "interview.languageZh" },
];

export function InterviewView() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { t } = useT();
  const { hydrated, consent, profile, interviewAnswers, setInterviewAnswers, setCourseLanguages } = useFlow();

  const [turn, setTurn] = useState(1);
  const [direction, setDirection] = useState(1);
  const [slots, setSlots] = useState<PartialSlots>(interviewAnswers);

  const [hours, setHours] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);

  const cvTasks = useMemo(
    () => (profile?.roles.flatMap((role) => role.tasks) ?? []).map((task) => task.trim()).filter(Boolean),
    [profile],
  );
  const hasCvTasks = cvTasks.length > 0;
  const tasks = useMemo(() => {
    // CV tasks first. The live parser does not return per-role tasks yet
    // (lib/parse-cv.ts), so fall back to the CV's matched ESCO skills, which
    // are phrased as activities ("plan schedule", "file documents").
    const fromCv =
      hasCvTasks ? cvTasks : (profile?.skills.filter((skill) => skill.matched).map((skill) => skill.label) ?? []);
    const seen = new Set<string>();
    const unique = fromCv
      .map((task) => task.trim())
      .filter((task) => {
        const key = task.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const capped = unique.slice(0, 5);
    return capped.length > 0 ? capped : [t("interview.mainTask"), t("interview.secondaryTask")];
  }, [cvTasks, hasCvTasks, profile, t]);
  const [mainTaskIndex, setMainTaskIndex] = useState(0);
  // The main task row starts with no weight ("") since it's weighted as the main task.
  const [taskLevels, setTaskLevels] = useState<string[]>(() => tasks.map((_, index) => (index === 0 ? "" : "some")));

  /** Moves "Main task" to a row; the row it leaves gets its weights back, defaulting to "A lot". */
  function chooseMainTask(index: number) {
    if (index === mainTaskIndex) return;
    const previous = mainTaskIndex;
    setTaskLevels((current) => levelsAfterMainTaskMove(tasks.map((_, i) => current[i] ?? "some"), previous));
    setMainTaskIndex(index);
  }

  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [otherTools, setOtherTools] = useState("");
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
  const currentTaskLevels = tasks.map((_, index) => taskLevels[index] ?? "some");

  function answerForCurrentTurn(): PartialSlots {
    switch (turn) {
      case 1:
        return {
          ...(hours != null ? { hours_per_week: hours } : {}),
          ...(budget != null ? { budget } : {}),
        };
      case 2: {
        const shares = taskSharesFromLevels(mainTaskIndex, currentTaskLevels);
        return {
          tasks: tasks.map((text, index) => ({ text, share: shares[index] })),
        };
      }
      case 3: {
        const otherEntries = selectedTools.includes("Other")
          ? otherTools
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [];
        const toolList = [...selectedTools.filter((label) => label !== "Other"), ...otherEntries];
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
      router.push("/exposure-intro");
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
  const aiUsageChip = AI_USAGE_CHIPS.find((chip) => chip.value === aiUsage);
  const employmentChip = EMPLOYMENT_STATUS_CHIPS.find((chip) => chip.value === employmentStatus);
  const impactChip = IMPACT_INTEREST_CHIPS.find((chip) => chip.value === impactInterest);
  const soFar: string[] = [
    activeProfile.roles[0]?.title ?? "",
    known.ageBand ? t("interview.ageTag", { age: known.ageBand }) : "",
    hours != null ? t("interview.hoursPerWeekTag", { hours: String(hours) }) : "",
    budget != null
      ? budget === 0
        ? t("interview.budgetFreeOnly")
        : t("interview.budgetUpTo", { budget: String(budget) })
      : "",
    turn > 2 ? t("interview.tasksWeighted", { count: String(tasks.length) }) : "",
    aiUsageChip ? t(aiUsageChip.labelKey) : "",
    employmentChip ? t(employmentChip.labelKey).split(" (")[0] : "",
    impactChip ? t(impactChip.labelKey) : "",
  ].filter(Boolean);

  const question = INTERVIEW_QUESTIONS[turn];
  const usesFallbackTasks = turn === 2 && !hasCvTasks;
  const questionTitleKey: MessageKey = usesFallbackTasks ? "interview.q2.fallbackTitle" : question.titleKey;
  const questionSubtitleKey = usesFallbackTasks ? "interview.q2.fallbackSubtitle" : question.subtitleKey;
  const slide = {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 40 * dir }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -40 * dir }),
  };

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-20 sm:px-6 md:px-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pt-6 pb-10 md:pt-10"
      >
        <PageHero title={t("interview.title")} lede={t("interview.lede")} titleClassName="md:text-[clamp(48px,7vw,96px)]" />
      </motion.div>

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
        <ol className="absolute inset-x-0 top-0 flex justify-between" aria-label={t("interview.progress")}>
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

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="panel order-2 overflow-hidden md:order-1">
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
              {t("interview.questionCount", { current: String(turn), total: String(MAX_INTERVIEW_TURNS) })}
            </p>
            <h2 className="mt-2 font-serif text-[24px] leading-[0.9] font-medium text-balance sm:text-[28px]">
              {t(questionTitleKey)}
            </h2>
            {questionSubtitleKey && (
              <p className="mt-1.5 text-[14px] text-grey">{t(questionSubtitleKey)}</p>
            )}

            <div className="mt-6">
              {turn === 1 && (
                <div className="flex flex-col gap-5">
                  <ChipRow label={t("interview.hoursLabel")}>
                    {HOURS_PER_WEEK_CHIPS.map((value) => (
                      <Chip key={value} selected={hours === value} onClick={() => setHours(value)}>
                        {t("interview.hoursChip", { hours: String(value) })}
                      </Chip>
                    ))}
                  </ChipRow>
                  <ChipRow label={t("interview.budgetLabel")}>
                    {BUDGET_CHIPS.map((chip) => (
                      <Chip key={chip.labelKey} selected={budget === chip.value} onClick={() => setBudget(chip.value)}>
                        {t(chip.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                </div>
              )}

              {turn === 2 && (
                <ul className="divide-y divide-line">
                  {tasks.map((task, index) => (
                    <li key={`${task}-${index}`} className="py-3">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <span className="text-[14px]">{task}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip compact selected={mainTaskIndex === index} onClick={() => chooseMainTask(index)}>
                            {t("interview.mainTask")}
                          </Chip>
                          {/* The main task row keeps its weight chips visible but greyed out and disabled. */}
                          {TASK_WEIGHT_LEVELS.map((level) => (
                            <Chip
                              key={level.value}
                              compact
                              disabled={mainTaskIndex === index}
                              selected={mainTaskIndex !== index && currentTaskLevels[index] === level.value}
                              onClick={() =>
                                setTaskLevels((current) =>
                                  tasks.map((_, i) => (i === index ? level.value : current[i] ?? "some")),
                                )
                              }
                            >
                              {t(level.labelKey)}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {turn === 3 && (
                <div className="flex flex-col gap-5">
                  <ChipRow label={t("interview.toolsLabel")}>
                    {TOOL_CHIPS.map((tool) => (
                      <Chip
                        key={tool.value}
                        selected={selectedTools.includes(tool.value)}
                        onClick={() =>
                          setSelectedTools((current) =>
                            current.includes(tool.value)
                              ? current.filter((item) => item !== tool.value)
                              : [...current, tool.value],
                          )
                        }
                      >
                        {t(tool.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                  {selectedTools.includes("Other") && (
                    <label className="block text-[12px] text-grey">
                      {t("interview.otherToolsLabel")}
                      <input
                        value={otherTools}
                        onChange={(event) => setOtherTools(event.target.value)}
                        placeholder={t("interview.otherToolsPlaceholder")}
                        className="field mt-1.5"
                      />
                    </label>
                  )}
                  <ChipRow label={t("interview.aiUsageLabel")}>
                    {AI_USAGE_CHIPS.map((chip) => (
                      <Chip key={chip.value} selected={aiUsage === chip.value} onClick={() => setAiUsage(chip.value)}>
                        {t(chip.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                </div>
              )}

              {turn === 4 && (
                <div className="flex flex-col gap-5">
                  <ChipRow label={t("interview.workStatusLabel")}>
                    {EMPLOYMENT_STATUS_CHIPS.map((chip) => (
                      <Chip key={chip.value} selected={employmentStatus === chip.value} onClick={() => setEmploymentStatus(chip.value)}>
                        {t(chip.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                  <ChipRow label={t("interview.perkesoLabel")}>
                    {PERKESO_CHIPS.map((chip) => (
                      <Chip key={chip.labelKey} selected={perkeso === chip.value} onClick={() => setPerkeso(chip.value)}>
                        {t(chip.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                </div>
              )}

              {turn === 5 && (
                <div className="flex flex-col gap-5">
                  <ChipRow label={t("interview.causeLabel")}>
                    {IMPACT_INTEREST_CHIPS.map((chip) => (
                      <Chip key={chip.value} selected={impactInterest === chip.value} onClick={() => setImpactInterest(chip.value)}>
                        {t(chip.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                  <ChipRow label={t("interview.courseLanguageLabel")}>
                    {STUDY_LANGUAGES.map((language) => (
                      <Chip
                        key={language.value}
                        selected={studyLanguage === language.value}
                        onClick={() => setCourseLanguages([language.value])}
                      >
                        {t(language.labelKey)}
                      </Chip>
                    ))}
                  </ChipRow>
                </div>
              )}
            </div>

            <p className="mt-6 text-[12px] text-grey">
              {t("interview.whyWeAsk", { why: t(question.whyKey) })}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
          <button type="button" onClick={handleBack} disabled={turn === 1} className="btn-ghost -ml-3">
            {t("interview.back")}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSkip} className="btn-ghost">
              {t("interview.skip")}
            </button>
            <button type="button" onClick={handleNext} className="btn-primary">
              {isInterviewDone(turn) ? t("interview.seeResults") : t("interview.next")}
              <ArrowRight className="size-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

        {/* So far: boarding stub of answers collected (right column at desktop) */}
        <aside className="order-1 self-start rounded-[28px] bg-card p-6 md:order-2">
          <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("interview.soFar")}</p>
          <ul className="mt-3 flex flex-col">
            <AnimatePresence initial={false}>
              {soFar.map((item) => (
                <motion.li
                  key={item}
                  layout
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={SPRING}
                  className="border-b border-dashed border-ink/15 py-2 font-mono text-[12px] text-ink last:border-b-0"
                >
                  {item}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </aside>
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
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn("chip", compact && "chip-sm", "disabled:cursor-not-allowed disabled:border-line disabled:bg-alt disabled:text-grey/60 disabled:hover:border-line disabled:active:scale-100")}
    >
      {children}
    </button>
  );
}
