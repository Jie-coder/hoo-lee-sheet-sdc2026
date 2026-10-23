// Profile (spec §2): pick a sample CV or upload your own on the left, then check
// and edit the parsed "passenger card" on the right before boarding the interview.
"use client";

import { decimalToYearsMonths, MAX_MONTHS, MAX_YEARS, yearsMonthsToDecimal } from "@/lib/years-months";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { EASE_OUT, SlideIn, SPRING } from "@/components/motion";
import { IllustrationPanel, PageHero, Perforation, SdgChip, Ticket } from "@/components/caldera";
import { cn } from "@/lib/utils";
import { CV_MIME_TYPE, MAX_CV_BYTES } from "@/lib/cv-upload-limits";
import { useFlow } from "@/context/flow-context";
import { PERSONA_IDS, PERSONAS, type PersonaId } from "@/mocks/personas";
import { useT, type MessageKey } from "@/lib/i18n";

/** Shown one at a time while POST /api/parse-cv is in flight. */
const UPLOAD_STEPS: ReadonlyArray<{ labelKey: MessageKey }> = [
  { labelKey: "profile.uploadStepReading" },
  { labelKey: "profile.uploadStepSkills" },
  { labelKey: "profile.uploadStepMatching" },
];

const STEP_INTERVAL_MS = 900;

/** Short label for a sample pill: first name · job title. */
// First names are explicit: Malaysian Chinese names put the surname first.
const SAMPLE_FIRST_NAMES: Record<PersonaId, string> = {
  aisyah: "Aisyah",
  "lim-jia-hui": "Jia Hui",
  pravin: "Pravin",
};

export function sampleLabel(id: PersonaId): string {
  return `${SAMPLE_FIRST_NAMES[id]} · ${PERSONAS[id].jobTitle}`;
}

/** Length of the loading transition shown after picking a sample CV. */
export const SAMPLE_LOADING_MS = 2500;

export function ProfileView() {
  const router = useRouter();
  const { t } = useT();
  const { hydrated, consent, profile, setSampleProfile, setUploadedProfile, updateProfile, addSkill, removeSkill } = useFlow();
  const [addingSkill, setAddingSkill] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loadingSample, setLoadingSample] = useState<PersonaId | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => () => {
    if (sampleTimerRef.current) clearTimeout(sampleTimerRef.current);
  }, []);

  // Sample results are precomputed; this is only a short loading transition
  // that shows the same generic loader as an upload.
  function pickSample(id: PersonaId) {
    if (loadingSample || uploading) return;
    setUploadError(null);
    setSkillsExpanded(false);
    setLoadingSample(id);
    sampleTimerRef.current = setTimeout(() => {
      sampleTimerRef.current = null;
      setSampleProfile(id);
      setLoadingSample(null);
    }, SAMPLE_LOADING_MS);
  }

  useEffect(() => {
    if (hydrated && !consent) router.replace("/");
  }, [hydrated, consent, router]);

  async function handleFile(file: File) {
    setUploadError(null);
    if (file.type !== CV_MIME_TYPE) {
      setUploadError(t("profile.toastPdfOnly"));
      toast.error(t("profile.toastPdfOnly"));
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setUploadError(t("profile.toastTooLarge"));
      toast.error(t("profile.toastTooLarge"));
      return;
    }

    setUploading(true);
    setStepIndex(0);
    const stepTimer = setInterval(() => {
      setStepIndex((index) => Math.min(index + 1, UPLOAD_STEPS.length - 1));
    }, STEP_INTERVAL_MS);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch("/api/parse-cv", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setUploadError(body?.error ?? t("profile.toastParseFallback"));
        toast.error(body?.error ?? t("profile.toastParseFallback"));
        return;
      }
      setUploadedProfile(body as Parameters<typeof setUploadedProfile>[0]);
      toast.success(t("profile.toastParsed"), { duration: 3000 });
    } catch {
      setUploadError(t("profile.toastNetwork"));
      toast.error(t("profile.toastNetwork"));
    } finally {
      clearInterval(stepTimer);
      setUploading(false);
    }
  }

  function handleAddSkillSubmit() {
    const value = skillDraft.trim();
    if (value) addSkill(value);
    setSkillDraft("");
    setAddingSkill(false);
  }

  function updateRole(index: number, patch: Partial<{ title: string; years: number }>) {
    if (!profile) return;
    const roles = profile.roles.map((role, i) => (i === index ? { ...role, ...patch } : role));
    updateProfile({ roles });
  }

  function addRole() {
    if (!profile) return;
    updateProfile({ roles: [...profile.roles, { title: "", years: 0, tasks: [] }] });
  }

  function removeRole(index: number) {
    if (!profile) return;
    updateProfile({ roles: profile.roles.filter((_, i) => i !== index) });
  }

  const matchedCount = profile?.skills.filter((skill) => skill.matched).length ?? 0;
  const totalSkills = profile?.skills.length ?? 0;
  const visibleSkills = skillsExpanded ? (profile?.skills ?? []) : (profile?.skills.slice(0, 5) ?? []);
  const education = profile?.education[0];

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-6 md:px-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <PageHero className="pt-6 md:pt-10" title={t("profile.heroHeading")} />
      </motion.div>

      <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-[420px_1fr] md:items-start">
        {/* Left: illustration + sample picker */}
        <div className="flex flex-col gap-4">
          <IllustrationPanel src="/illustrations/u1.svg" panel="plasma" className="h-[300px] max-md:hidden" />

          <div className="rounded-[40px] bg-card p-7">
            <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("profile.orTrySample")}</p>
            <div className="mt-4 grid gap-2 max-md:grid-cols-1">
              {PERSONA_IDS.map((id) => {
                const isLoading = loadingSample === id;
                const selected = isLoading || (!loadingSample && profile?.personaId === id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={loadingSample !== null || uploading}
                    aria-busy={loadingSample === id}
                    onClick={() => pickSample(id)}
                    className={cn(
                      "flex items-center justify-between rounded-full border-[1.5px] px-6 py-3.5 text-[15px] font-bold transition-colors max-md:gap-3 max-md:text-left max-md:text-[14px]",
                      isLoading
                        ? "border-obsidian bg-obsidian text-limestone"
                        : selected
                          ? "border-ink bg-ink text-paper"
                          : "border-ink/80 text-ink hover:bg-alt",
                    )}
                  >
                    <span className="max-md:min-w-0 max-md:truncate">{sampleLabel(id)}</span>
                    <span aria-hidden className="max-md:shrink-0">{isLoading ? (
                        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                      ) : selected ? (
                        <Check className="size-4" strokeWidth={2.4} />
                      ) : (
                        "→"
                      )}</span>
                  </button>
                );
              })}
            </div>

            <Perforation className="my-6" />

            {/* Upload: collapsed by default, opens on click (progressive disclosure) */}
            {!uploadOpen && !uploading ? (
              <button
                type="button"
                data-testid="profile-upload-open"
                onClick={() => setUploadOpen(true)}
                className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase transition-colors hover:text-ink"
              >
                {t("profile.uploadOwnCta")} →
              </button>
            ) : (
              <div
                data-testid="profile-upload-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file && !uploading) void handleFile(file);
                }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink/30 px-5 py-8 text-center text-[13px] text-grey"
              >
                {uploading ? (
                  <UploadProgress stepIndex={stepIndex} />
                ) : (
                  <>
                    <Upload className="size-6" strokeWidth={1.6} />
                    <span>
                      {t("profile.dropPrefix")}
                      <button
                        type="button"
                        data-testid="profile-upload-browse"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-ink underline underline-offset-4"
                      >
                        {t("profile.browse")}
                      </button>
                      {t("profile.dropSuffix")}
                    </span>
                    <span>{t("profile.dropPrivacy")}</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={CV_MIME_TYPE}
                  data-testid="profile-upload-input"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
            )}
            {uploadError && (
              <p role="alert" className="mt-3 text-[12px] text-signal-high">
                {uploadError}
              </p>
            )}
            <p className="mt-3 font-mono text-[11px] tracking-[0.04em] text-grey/80 uppercase">{t("profile.heroLede")}</p>
          </div>
        </div>

        {/* Right: passenger ticket, or an empty-state ticket before a pick */}
        {loadingSample || uploading ? (
          <Ticket notch className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center md:self-stretch">
            <ProfileLoading />
          </Ticket>
        ) : profile ? (
          <AnimatePresence mode="wait">
            <SlideIn key={profile.personaId}>
              <Ticket notch notchTop="152px" className="p-8 md:p-12">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 sm:flex-1">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("profile.passengerLabel")}</p>
                    <textarea
                      rows={1}
                      value={profile.name}
                      onChange={(event) => updateProfile({ name: event.target.value.replace(/\n/g, " ") })}
                      aria-label={t("profile.nameLabel")}
                      className="mt-2.5 block w-full min-w-0 resize-none overflow-hidden bg-transparent font-serif text-[clamp(32px,6vw,52px)] leading-[0.9] tracking-[-0.01em] uppercase outline-none [field-sizing:content] focus:underline"
                    />
                    {education && (
                      <p className="mt-2 text-[15px] text-grey">
                        {education.level}
                        {education.field ? `, ${education.field}` : ""}
                      </p>
                    )}
                  </div>
                  <SdgChip className="shrink-0 normal-case">
                    {t("profile.skillsMatched", { matched: String(matchedCount), total: String(totalSkills) })}
                  </SdgChip>
                </div>

                <Perforation className="my-7" />

                {/* Route history */}
                <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">{t("profile.routeHistory")}</p>
                <ul className="mt-3">
                  {profile.roles.map((role, index) => (
                    <RoleDurationRow
                      key={index}
                      title={role.title}
                      years={role.years}
                      onTitle={(title) => updateRole(index, { title })}
                      onYears={(years) => updateRole(index, { years })}
                      onRemove={() => removeRole(index)}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addRole}
                  className="mt-3 font-mono text-[12px] tracking-[0.06em] text-grey uppercase hover:text-ink"
                >
                  + {t("profile.addRole")}
                </button>

                <Perforation className="my-7" />

                {/* Skills & tools */}
                <p className="font-mono text-[12px] tracking-[0.06em] text-grey uppercase">
                  {t("profile.skillsAndTools")} · {totalSkills}
                </p>
                <motion.div layout className="mt-3.5 flex flex-wrap gap-2">
                  <AnimatePresence initial={false}>
                    {visibleSkills.map((skill) => (
                      <motion.span
                        key={skill.id}
                        layout
                        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? undefined : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                        transition={SPRING}
                        className="inline-flex items-center gap-1.5 rounded-full bg-paper py-1.5 pr-2 pl-3.5 font-mono text-[12px] text-ink"
                      >
                        {skill.label}
                        <button
                          type="button"
                          aria-label={t("profile.removeSkill", { skill: skill.label })}
                          onClick={() => removeSkill(skill.id)}
                          className="rounded-full p-0.5 text-grey transition-colors hover:bg-line hover:text-ink"
                        >
                          <X className="size-3.5" strokeWidth={1.8} />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  {totalSkills > 5 && (
                    <button
                      type="button"
                      onClick={() => setSkillsExpanded((expanded) => !expanded)}
                      className="rounded-full bg-paper px-3 py-1.5 font-mono text-[12px] text-ink hover:bg-alt"
                    >
                      {skillsExpanded ? t("profile.showLess") : t("profile.moreSkills", { count: String(totalSkills - 5) })}
                    </button>
                  )}
                  {addingSkill ? (
                    <span className="inline-flex items-center rounded-full border border-dashed border-ink/50 py-1.5 pr-2 pl-3.5 font-mono text-[12px]">
                      <input
                        autoFocus
                        value={skillDraft}
                        onChange={(event) => setSkillDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleAddSkillSubmit();
                          if (event.key === "Escape") {
                            setSkillDraft("");
                            setAddingSkill(false);
                          }
                        }}
                        onBlur={handleAddSkillSubmit}
                        placeholder={t("profile.skillPlaceholder")}
                        className="w-28 bg-transparent outline-none"
                      />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSkill(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/50 px-3.5 py-1.5 font-mono text-[12px] text-grey hover:text-ink"
                    >
                      <Plus className="size-3.5" strokeWidth={1.8} />
                      {t("profile.addSkill")}
                    </button>
                  )}
                </motion.div>

                {/* Footer */}
                <div className="mt-10 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
                  <p className="text-[14px] text-grey">{t("profile.nextLine")}</p>
                  <button
                    type="button"
                    onClick={() => router.push("/interview")}
                    className="btn-primary w-full justify-center px-6 py-3.5 text-[15px] sm:w-auto"
                  >
                    {t("profile.boardInterview")}
                  </button>
                </div>
              </Ticket>
            </SlideIn>
          </AnimatePresence>
        ) : (
          <Ticket notch className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center md:self-stretch">
            <svg aria-hidden viewBox="0 0 120 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-6 h-16 w-[120px] text-ink/20">
              <path d="M8 4h104a4 4 0 0 1 4 4v14a10 10 0 0 0 0 20v14a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V42a10 10 0 0 0 0-20V8a4 4 0 0 1 4-4Z" />
              <path d="M84 8v48" strokeDasharray="3 4" />
              <path d="M18 22h44M18 32h30M18 42h38" />
            </svg>
            <p className="font-serif text-[28px] uppercase">{t("profile.emptyStateTitle")}</p>
            <p className="mt-2 max-w-[320px] text-[14px] text-grey">{t("profile.emptyStateBody")}</p>
          </Ticket>
        )}
      </div>
    </main>
  );
}

/** One route-history row: ROLE | COMPANY | [n yrs | n mos] pill | ×. */
function RoleDurationRow({
  title,
  years,
  onTitle,
  onYears,
  onRemove,
}: {
  title: string;
  years: number;
  onTitle: (title: string) => void;
  onYears: (years: number) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const split = decimalToYearsMonths(years);
  const numberClass =
    "h-[30px] w-[42px] [appearance:textfield] bg-transparent text-center font-mono text-[13px] text-ink tabular-nums outline-none focus-visible:underline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  return (
    <li className="flex flex-col gap-2 border-b border-ink/10 py-4 last:border-b-0 md:grid md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center md:gap-4">
      {/* Mobile line 1: role + company. Desktop: both dissolve into the grid. */}
      <div className="flex items-baseline justify-between gap-3 md:contents">
        <textarea
          rows={1}
          value={title}
          onChange={(event) => onTitle(event.target.value.replace(/\n/g, " "))}
          placeholder={t("profile.roleTitlePlaceholder")}
          aria-label={t("profile.roleFieldLabel")}
          className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-[15px] leading-snug font-bold outline-none [field-sizing:content] focus:underline"
        />
        <span className="shrink-0 text-[14px] text-grey">{t("profile.companyFromCv")}</span>
      </div>
      {/* Mobile line 2: duration pill + remove. Desktop: dissolve into the grid. */}
      <div className="flex items-center justify-between gap-3 md:contents">
        <span className="inline-flex shrink-0 items-center rounded-full border-[1.5px] border-ink md:justify-self-start">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_YEARS}
            step={1}
            aria-label={t("profile.yearsLabel")}
            value={split.years}
            onChange={(event) => onYears(yearsMonthsToDecimal(Number(event.target.value), split.months))}
            className={numberClass}
          />
          <span className="pr-2.5 font-mono text-[11px] text-grey uppercase">{t("profile.yearsShort")}</span>
          <span aria-hidden className="h-6 w-px bg-ink/30" />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_MONTHS}
            step={1}
            aria-label={t("profile.monthsLabel")}
            value={split.months}
            onChange={(event) => onYears(yearsMonthsToDecimal(split.years, Number(event.target.value)))}
            className={numberClass}
          />
          <span className="pr-2.5 font-mono text-[11px] text-grey uppercase">{t("profile.monthsShort")}</span>
        </span>
        <button
          type="button"
          aria-label={t("profile.removeRole", { role: title || t("profile.roleFallback") })}
          onClick={onRemove}
          className="shrink-0 rounded-full p-1 text-grey/50 transition-colors hover:bg-alt hover:text-ink md:justify-self-end"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </li>
  );
}

/** Generic waiting state shared by CV upload and sample pick. */
function ProfileLoading() {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 text-[14px] text-ink" data-testid="profile-loading" role="status" aria-live="polite">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      {t("profile.loading")}
    </div>
  );
}

function UploadProgress({ stepIndex }: { stepIndex: number }) {
  const { t } = useT();
  return (
    <ul className="flex flex-col gap-2" data-testid="profile-upload-progress">
      {UPLOAD_STEPS.map((step, index) => (
        <li key={step.labelKey} className={cn("flex items-center gap-2", index === stepIndex ? "text-ink" : "text-grey")}>
          {index < stepIndex ? (
            <Check className="size-3.5" strokeWidth={2} />
          ) : index === stepIndex ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <span className="size-3.5" />
          )}
          {t(step.labelKey)}
        </li>
      ))}
    </ul>
  );
}
