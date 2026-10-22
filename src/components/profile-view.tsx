// Profile: upload a synthetic CV (drag & drop or browse), watch it parse,
// then check and edit what was read from it before continuing to the interview.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { EASE_OUT, SlideIn, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CV_MIME_TYPE, MAX_CV_BYTES } from "@/lib/cv-upload-limits";
import { useFlow, type UploadedCv } from "@/context/flow-context";

/** Shown one at a time while POST /api/parse-cv is in flight. */
const UPLOAD_STEPS = ["Reading CV", "Extracting skills", "Matching to ESCO"] as const;

/** How often the step indicator advances while waiting for the response. The
 * server does the real work in one call; this just keeps the wait legible. */
const STEP_INTERVAL_MS = 900;

export function ProfileView() {
  const router = useRouter();
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
      toast.error("Please upload a PDF.");
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      toast.error("That CV is over 2 MB. Please upload a smaller PDF.");
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
        toast.error(body?.error ?? "Could not read that CV. Please try another file.");
        return;
      }
      setUploadedProfile(body as UploadedCv);
      toast.success("Parsed. Check the details below.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
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

  return (
    <main className="mx-auto max-w-[1248px] px-4 pb-20 sm:px-6">
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pt-10 pb-8"
      >
        <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">Upload your CV</h1>
        <p className="mt-2 text-[15px] text-grey">A synthetic PDF. We read the skills so you can check them.</p>
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
              Drop a synthetic CV here, or{" "}
              <button
                type="button"
                data-testid="profile-upload-browse"
                onClick={() => fileInputRef.current?.click()}
                className="text-ink underline underline-offset-4"
              >
                browse
              </button>
              . PDF, up to 2 MB.
            </span>
            <span>Never a real CV: no real names, IC or phone numbers.</span>
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
                <div className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-[#E6EFEA] font-serif text-[22px] text-[#24634A] md:size-[76px] md:text-[26px]">
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
                  <p className="text-[12px] text-grey">Skills from CV</p>
                </div>
                <div className="rounded-xl border border-line px-4 py-3 md:min-w-[132px] md:max-w-[220px]">
                  <p className="font-serif text-[28px] tabular-nums">{totalYears}</p>
                  <p className="text-[12px] text-grey">Years of experience</p>
                </div>
                <div className="col-span-2 rounded-xl border border-line px-4 py-3 md:col-span-1 md:min-w-[132px] md:max-w-[220px]">
                  <p className="font-serif text-[16px] leading-snug">{profile.education[0]?.level || "—"}</p>
                  <p className="text-[12px] text-grey">{profile.education[0]?.field || "Education"}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="tag">
                {matchedCount} of {profile.skills.length} skills matched to ESCO
              </span>
              <p className="text-[12px] text-grey">Remove anything wrong, add what is missing.</p>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="md:col-span-8">
                <label className="block max-w-sm text-[12px] text-grey">
                  Name
                  <input
                    value={profile.name}
                    onChange={(event) => updateProfile({ name: event.target.value })}
                    placeholder="Your name"
                    className="field mt-1.5"
                  />
                </label>

                <p className="mt-6 mb-2.5 text-[12px] text-grey">
                  Skills and tools <span className="tabular-nums">({profile.skills.length})</span>
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
                        {skill.selfReported && <span className="text-[10px] tracking-wide text-grey uppercase">added</span>}
                        <button
                          type="button"
                          aria-label={`Remove ${skill.label}`}
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
                      className="chip border-[#B9CFC6] bg-[#F1F6F3] font-medium text-[#24634A]"
                    >
                      {skillsExpanded ? "Show less" : `+${profile.skills.length - 6}`}
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
                        placeholder="Skill name"
                        className="w-32 bg-transparent outline-none"
                      />
                    </span>
                  ) : (
                    <button type="button" onClick={() => setAddingSkill(true)} className="chip border-dashed text-grey">
                      <Plus className="size-3.5" strokeWidth={1.8} />
                      Add a skill
                    </button>
                  )}
                </motion.div>

                <p className="mt-7 mb-1 text-[12px] text-grey">Roles</p>
                <ul className="divide-y divide-line text-[14px]">
                  {profile.roles.map((role, index) => (
                    <li key={index} className="flex items-center gap-2 py-2">
                      <input
                        value={role.title}
                        onChange={(event) => updateRole(index, { title: event.target.value })}
                        placeholder="Role title"
                        className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 transition-colors hover:border-line focus:border-line focus:outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={role.years}
                        onChange={(event) => updateRole(index, { years: Number(event.target.value) })}
                        className="w-16 rounded-lg border border-transparent px-2 py-1 text-right tabular-nums transition-colors hover:border-line focus:border-line focus:outline-none"
                      />
                      <span className="text-[13px] text-grey">yrs</span>
                      <button
                        type="button"
                        aria-label={`Remove ${role.title || "role"}`}
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
                  Add a role
                </button>
              </div>

              <div className="space-y-6 text-[14px] md:col-span-4 md:border-l md:border-line md:pl-8">
                <div>
                  <p className="mb-2 text-[12px] text-grey">Education</p>
                  <ul className="space-y-2">
                    {profile.education.map((item, index) => (
                      <li key={index} className="flex flex-wrap items-center gap-1.5">
                        <textarea
                          value={item.level}
                          onChange={(event) => updateEducation(index, { level: event.target.value })}
                          placeholder="Qualification"
                          rows={1}
                          className="field field-sizing-content min-w-[8rem] flex-1 resize-none px-2 py-1 text-[13px]"
                        />
                        <textarea
                          value={item.field}
                          onChange={(event) => updateEducation(index, { field: event.target.value })}
                          placeholder="Field of study"
                          rows={1}
                          className="field field-sizing-content min-w-[8rem] flex-1 resize-none px-2 py-1 text-[13px]"
                        />
                        <button
                          type="button"
                          aria-label="Remove education entry"
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
                    Add education
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse items-center justify-between gap-3 border-t border-line pt-5 sm:flex-row">
              <p className="text-[13px] text-grey">Next: five quick questions.</p>
              <button type="button" onClick={() => router.push("/interview")} className="btn-primary w-full sm:w-auto">
                Continue
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
  return (
    <ul className="flex flex-col gap-2" data-testid="profile-upload-progress">
      {UPLOAD_STEPS.map((step, index) => (
        <li
          key={step}
          className={cn("flex items-center gap-2", index === stepIndex ? "text-ink" : "text-grey")}
        >
          {index < stepIndex ? (
            <Check className="size-3.5" strokeWidth={2} />
          ) : index === stepIndex ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <span className="size-3.5" />
          )}
          {step}
        </li>
      ))}
    </ul>
  );
}
