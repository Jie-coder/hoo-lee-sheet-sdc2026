// Profile: upload a CV (own or sample) (drag & drop or browse), watch it parse,
// then check and edit what was read from it before continuing to the interview.
"use client";

import { decimalToYearsMonths, MAX_MONTHS, MAX_YEARS, yearsMonthsToDecimal } from "@/lib/years-months";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { EASE_OUT, SlideIn, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CV_MIME_TYPE, MAX_CV_BYTES } from "@/lib/cv-upload-limits";
import { useFlow, type UploadedCv } from "@/context/flow-context";
import { useT, type MessageKey } from "@/lib/i18n";

/** Shown one at a time while POST /api/parse-cv is in flight. */
const UPLOAD_STEPS: ReadonlyArray<{ labelKey: MessageKey }> = [
  { labelKey: "profile.uploadStepReading" },
  { labelKey: "profile.uploadStepSkills" },
  { labelKey: "profile.uploadStepMatching" },
];

/** How often the step indicator advances while waiting for the response. The
 * server does the real work in one call; this just keeps the wait legible. */
const STEP_INTERVAL_MS = 900;

/** The stat block shows the qualification large and its field below. When the
 * level already names the field ("Diploma in Business Studies"), drop the
 * duplicated " in <field>" so it reads "Diploma" plus "Business Studies". */
function formatEducationStat(level: string, field: string): { level: string; field: string } {
  const trimmedLevel = level.trim();
  const trimmedField = field.trim();
  if (!trimmedField) return { level: trimmedLevel, field: "" };
  const escapedField = trimmedField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = trimmedLevel
    .replace(new RegExp(`\\s+in\\s+${escapedField}(?=\\s|$|[.,;])`, "i"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (stripped && stripped.toLowerCase() !== trimmedField.toLowerCase()) {
    return { level: stripped, field: trimmedField };
  }
  if (trimmedLevel.toLowerCase() === trimmedField.toLowerCase()) return { level: trimmedLevel, field: "" };
  return { level: trimmedLevel, field: trimmedField };
}

export function ProfileView() {
  const router = useRouter();
  const { t } = useT();
  const { hydrated, consent, profile, setUploadedProfile, updateProfile, addSkill, removeSkill } = useFlow();
  const [addingSkill, setAddingSkill] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (hydrated && !consent) router.replace("/");
  }, [hydrated, consent, router]);

  async function handleFile(file: File) {
    if (file.type !== CV_MIME_TYPE) {
      toast.error(t("profile.toastPdfOnly"));
      return;
    }
    if (file.size > MAX_CV_BYTES) {
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
        toast.error(body?.error ?? t("profile.toastParseFallback"));
        return;
      }
      setUploadedProfile(body as UploadedCv);
      toast.success(t("profile.toastParsed"), { duration: 3000 });
    } catch {
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

  function updateEducation(index: number, patch: Partial<{ level: string; field: string }>) {
    if (!profile) return;
    const education = profile.education.map((item, i) => (i === index ? { ...item, ...patch } : item));
    updateProfile({ education });
  }

  function addEducation() {
    if (!profile) return;
    updateProfile({ education: [...profile.education, { level: "", field: "" }] });
  }

  function removeEducation(index: number) {
    if (!profile) return;
    updateProfile({ education: profile.education.filter((_, i) => i !== index) });
  }

  const matchedCount = profile?.skills.filter((skill) => skill.matched).length ?? 0;
  const initials =
    profile?.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";
  const totalYears = (profile?.roles.reduce((sum, role) => sum + role.years, 0) ?? 0).toFixed(1);
  const visibleSkills = skillsExpanded ? (profile?.skills ?? []) : (profile?.skills.slice(0, 6) ?? []);
  const educationStat = profile?.education[0]
    ? formatEducationStat(profile.education[0].level, profile.education[0].field)
    : null;

  return (
    <main className="mx-auto max-w-[1248px] px-4 pb-20 sm:px-6">
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pt-10 pb-8"
      >
        <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">{t("profile.uploadTitle")}</h1>
        <p className="mt-2 text-[15px] text-grey">{t("profile.uploadLede")}</p>
      </motion.section>

      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        data-testid="profile-upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file && !uploading) void handleFile(file);
        }}
        className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-5 py-10 text-center text-[13px] text-grey"
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
      </motion.div>

      {/* Parsed profile */}
      <AnimatePresence mode="wait">
        {profile && (
          <SlideIn key={profile.personaId} className="panel mt-8 p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-sage-soft font-serif text-[22px] text-sage-dark md:size-[76px] md:text-[26px]">
                  {initials}
                </div>
                <div>
                  <p className="font-serif text-[28px] leading-[1.1] md:text-[34px]">{profile.name}</p>
                  <p className="mt-1.5 text-grey">{profile.roles[0]?.title}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:flex">
                <div className="rounded-xl border border-line px-4 py-3 md:min-w-[132px] md:max-w-[220px]">
                  <p className="font-serif text-[28px] tabular-nums">{profile.skills.length}</p>
                  <p className="text-[12px] text-grey">{t("profile.skillsFromCv")}</p>
                </div>
                <div className="rounded-xl border border-line px-4 py-3 md:min-w-[132px] md:max-w-[220px]">
                  <p className="font-serif text-[28px] tabular-nums">{totalYears}</p>
                  <p className="text-[12px] text-grey">{t("profile.yearsExperience")}</p>
                </div>
                <div className="col-span-2 rounded-xl border border-line px-4 py-3 md:col-span-1 md:min-w-[132px] md:max-w-[220px]">
                  <p className="font-serif text-[16px] leading-snug">{educationStat?.level || "—"}</p>
                  <p className="text-[12px] text-grey">{educationStat?.field || t("profile.educationLabel")}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="tag">
                {t("profile.skillsMatched", { matched: String(matchedCount), total: String(profile.skills.length) })}
              </span>
              <p className="text-[12px] text-grey">{t("profile.editHint")}</p>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="md:col-span-8">
                <label className="block max-w-sm text-[12px] text-grey">
                  {t("profile.nameLabel")}
                  <input
                    value={profile.name}
                    onChange={(event) => updateProfile({ name: event.target.value })}
                    placeholder={t("profile.namePlaceholder")}
                    className="field mt-1.5"
                  />
                </label>

                <p className="mt-6 mb-2.5 text-[12px] text-grey">
                  {t("profile.skillsAndTools")} <span className="tabular-nums">({profile.skills.length})</span>
                </p>
                <motion.div layout className="flex flex-wrap gap-2">
                  <AnimatePresence initial={true}>
                    {visibleSkills.map((skill, index) => (
                      <motion.span
                        key={skill.id}
                        layout
                        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? undefined : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                        transition={{ ...SPRING, delay: reduce ? 0 : Math.min(index * 0.03, 0.5) }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-alt py-1 pr-1.5 pl-3 text-[13px]"
                      >
                        {skill.label}
                        {skill.selfReported && <span className="text-[10px] tracking-wide text-grey uppercase">{t("profile.skillAdded")}</span>}
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
                  {profile.skills.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setSkillsExpanded((expanded) => !expanded)}
                      className="chip border-sage/40 bg-sage-wash font-medium text-sage-dark"
                    >
                      {skillsExpanded ? t("profile.showLess") : `+${profile.skills.length - 6}`}
                    </button>
                  )}
                  {addingSkill ? (
                    <span className="inline-flex items-center rounded-full border border-dashed border-grey/50 py-1 pr-2 pl-3 text-[13px]">
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
                        className="w-32 bg-transparent outline-none"
                      />
                    </span>
                  ) : (
                    <button type="button" onClick={() => setAddingSkill(true)} className="chip border-dashed text-grey">
                      <Plus className="size-3.5" strokeWidth={1.8} />
                      {t("profile.addSkill")}
                    </button>
                  )}
                </motion.div>

                <p className="mt-7 mb-1 text-[12px] text-grey">{t("profile.rolesLabel")}</p>
                <ul className="divide-y divide-line text-[14px]">
                  {profile.roles.map((role, index) => (
                    <li key={index} className="flex flex-wrap items-end gap-x-2 gap-y-2 py-2">
                      <input
                        value={role.title}
                        onChange={(event) => updateRole(index, { title: event.target.value })}
                        placeholder={t("profile.roleTitlePlaceholder")}
                        className="h-10 min-w-[12rem] flex-1 rounded-lg border border-transparent px-2 py-1 transition-colors hover:border-line focus:border-line focus:outline-none"
                      />
                      {(() => {
                        // Design option B: one pill, units inside the border.
                        // yearsMonthsToDecimal clamps/truncates out-of-range input.
                        const split = decimalToYearsMonths(role.years);
                        const numberClass =
                          "h-[30px] w-[38px] [appearance:textfield] rounded-full bg-sage-wash text-center font-semibold text-sage-dark tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-sage/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
                        return (
                          <div className="flex shrink-0 flex-col gap-1">
                            <span className="text-[10px] leading-none font-medium tracking-[0.12em] text-grey uppercase">
                              {t("profile.durationLabel")}
                            </span>
                            <span className="flex h-10 shrink-0 items-center rounded-full border border-line bg-white px-1.5 text-[14px]">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={MAX_YEARS}
                                step={1}
                                aria-label={t("profile.yearsLabel")}
                                value={split.years}
                                onChange={(event) =>
                                  updateRole(index, { years: yearsMonthsToDecimal(Number(event.target.value), split.months) })
                                }
                                className={numberClass}
                              />
                              <span className="pr-3 pl-2 text-[13px] text-grey">{t("profile.yearsShort")}</span>
                              <span aria-hidden className="mr-1.5 h-5 w-px bg-line" />
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={MAX_MONTHS}
                                step={1}
                                aria-label={t("profile.monthsLabel")}
                                value={split.months}
                                onChange={(event) =>
                                  updateRole(index, { years: yearsMonthsToDecimal(split.years, Number(event.target.value)) })
                                }
                                className={numberClass}
                              />
                              <span className="pr-3 pl-2 text-[13px] text-grey">{t("profile.monthsShort")}</span>
                            </span>
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        aria-label={t("profile.removeRole", { role: role.title || t("profile.roleFallback") })}
                        onClick={() => removeRole(index)}
                        className="rounded-full p-1 text-grey transition-colors hover:bg-alt hover:text-ink"
                      >
                        <X className="size-3.5" strokeWidth={1.8} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={addRole} className="mt-2 flex items-center gap-1.5 text-[12px] text-grey hover:text-ink">
                  <Plus className="size-3.5" strokeWidth={1.8} />
                  {t("profile.addRole")}
                </button>
              </div>

              <div className="space-y-6 text-[14px] md:col-span-4 md:border-l md:border-line md:pl-8">
                <div>
                  <p className="mb-2 text-[12px] text-grey">{t("profile.educationLabel")}</p>
                  <ul className="space-y-2">
                    {profile.education.map((item, index) => (
                      <li key={index} className="flex flex-wrap items-center gap-1.5">
                        <textarea
                          value={item.level}
                          onChange={(event) => updateEducation(index, { level: event.target.value })}
                          placeholder={t("profile.qualificationPlaceholder")}
                          rows={1}
                          className="field field-sizing-content min-w-[8rem] flex-1 resize-none px-2 py-1 text-[13px]"
                        />
                        <textarea
                          value={item.field}
                          onChange={(event) => updateEducation(index, { field: event.target.value })}
                          placeholder={t("profile.fieldPlaceholder")}
                          rows={1}
                          className="field field-sizing-content min-w-[8rem] flex-1 resize-none px-2 py-1 text-[13px]"
                        />
                        <button
                          type="button"
                          aria-label={t("profile.removeEducation")}
                          onClick={() => removeEducation(index)}
                          className="rounded-full p-1 text-grey transition-colors hover:bg-alt hover:text-ink"
                        >
                          <X className="size-3.5" strokeWidth={1.8} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={addEducation} className="mt-2 flex items-center gap-1.5 text-[12px] text-grey hover:text-ink">
                    <Plus className="size-3.5" strokeWidth={1.8} />
                    {t("profile.addEducation")}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse items-center justify-between gap-3 border-t border-line pt-5 sm:flex-row">
              <p className="text-[13px] text-grey">{t("profile.nextHint")}</p>
              <button type="button" onClick={() => router.push("/interview")} className="btn-primary w-full sm:w-auto">
                {t("profile.continue")}
                <ArrowRight className="size-4" strokeWidth={1.8} />
              </button>
            </div>
          </SlideIn>
        )}
      </AnimatePresence>
    </main>
  );
}

function UploadProgress({ stepIndex }: { stepIndex: number }) {
  const { t } = useT();
  return (
    <ul className="flex flex-col gap-2" data-testid="profile-upload-progress">
      {UPLOAD_STEPS.map((step, index) => (
        <li
          key={step.labelKey}
          className={cn("flex items-center gap-2", index === stepIndex ? "text-ink" : "text-grey")}
        >
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
