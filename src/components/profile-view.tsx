// Profile: pick a sample CV (or upload a synthetic one), then check and
// edit what was read from it before continuing to the interview.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { CourseLanguageToggle } from "@/components/course-language-toggle";
import { EASE_OUT, SlideIn, SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";
import { useFlow } from "@/context/flow-context";
import { PERSONA_IDS, PERSONAS, type PersonaId } from "@/mocks/personas";

export function ProfileView() {
  const router = useRouter();
  const { hydrated, consent, profile, selectPersona, startUploadProfile, updateProfile, addSkill, removeSkill, toggleCourseLanguage } =
    useFlow();
  const [addingSkill, setAddingSkill] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (hydrated && !consent) router.replace("/");
  }, [hydrated, consent, router]);

  function handleUploadFile() {
    startUploadProfile();
    toast.success("Mock parse complete. Fill in or edit the details below.");
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

  const persona = profile && profile.personaId !== "upload" ? PERSONAS[profile.personaId] : null;
  const matchedCount = profile?.skills.filter((skill) => skill.matched).length ?? 0;

  return (
    <main className="mx-auto max-w-[1248px] px-4 pb-20 sm:px-6">
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pt-10 pb-8"
      >
        <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-tight md:text-[44px]">Pick a sample CV</h1>
        <p className="mt-2 text-[15px] text-grey">Three fictional people, three different situations.</p>
      </motion.section>

      <motion.section
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {PERSONA_IDS.map((id) => (
          <PersonaCard key={id} id={id} selected={profile?.personaId === id} onSelect={() => selectPersona(id)} />
        ))}
      </motion.section>

      {/* Upload (secondary) */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleUploadFile();
        }}
        className="mt-4 flex flex-col gap-3 rounded-3xl border border-dashed border-line px-5 py-4 text-[13px] text-grey sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-center gap-2.5">
          <Upload className="size-4" strokeWidth={1.6} />
          <span>
            Or drop a synthetic CV here, or{" "}
            <button type="button" data-testid="profile-upload-browse" onClick={() => fileInputRef.current?.click()} className="text-ink underline underline-offset-4">
              browse
            </button>
            . PDF, up to 2 MB.
          </span>
        </span>
        <span>Never a real CV: no real names, IC or phone numbers.</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) handleUploadFile();
            event.target.value = "";
          }}
        />
      </motion.div>

      {/* Parsed profile */}
      <AnimatePresence mode="wait">
        {profile && (
          <SlideIn key={profile.personaId} className="panel mt-8 p-6 sm:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-serif text-[26px] font-medium tracking-tight">
                  {persona ? `Read from ${persona.name.split(" ")[0]}'s CV` : "Your uploaded profile"}
                </h2>
                <p className="mt-1 text-[14px] text-grey">Remove anything wrong, add what is missing.</p>
              </div>
              {persona && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="tag">
                    {matchedCount} of {profile.skills.length} skills matched to ESCO
                  </span>
                  <span className="tag">Parsed {persona.parsedOn}</span>
                </div>
              )}
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
                    {profile.skills.map((skill, index) => (
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
                <p className="mt-3 text-[12px] text-grey">Skills you add count at half weight until a course confirms them.</p>

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
                          placeholder="Institution"
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
                <div>
                  <p className="mb-2 text-[12px] text-grey">Course language</p>
                  <CourseLanguageToggle value={profile.courseLanguages} onToggle={toggleCourseLanguage} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse items-center justify-between gap-3 border-t border-line pt-5 sm:flex-row">
              <p className="text-[13px] text-grey">Next: five quick questions.</p>
              <button type="button" data-testid="profile-continue" onClick={() => router.push("/interview")} className="btn-primary w-full sm:w-auto">
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

function PersonaCard({ id, selected, onSelect }: { id: PersonaId; selected: boolean; onSelect: () => void }) {
  const persona = PERSONAS[id];
  const reduce = useReducedMotion();
  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } } }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn(
        "panel relative flex cursor-pointer flex-col p-6 transition-[border-color,box-shadow] duration-200",
        selected ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "hover:border-grey/40",
      )}
      onClick={onSelect}
      data-testid={`persona-card-${id}`}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-11 items-center justify-center rounded-full font-serif text-[16px] font-medium transition-colors",
            selected ? "bg-ink text-paper" : "bg-alt text-grey",
          )}
        >
          {persona.initials}
        </span>
        <motion.span
          initial={false}
          animate={{ scale: selected ? 1 : 0.6, opacity: selected ? 1 : 0 }}
          transition={SPRING}
          className="flex size-6 items-center justify-center rounded-full bg-sage text-paper"
        >
          <Check className="size-3.5" strokeWidth={2.4} />
        </motion.span>
      </div>
      <h3 className="mt-5 font-serif text-[24px] leading-tight font-medium">
        {persona.name}
        {persona.nameLocal && <span className="ml-2 font-sans text-[16px] font-normal text-grey">{persona.nameLocal}</span>}
      </h3>
      <p className="mt-1.5 text-[14px]">
        {persona.jobTitle}, <span className="tabular-nums">{persona.age}</span>
      </p>
      <p className="text-[13px] text-grey">{persona.location}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-grey">{persona.summary}</p>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[12px]">
        <a
          href={persona.cvUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="flex items-center gap-1.5 text-grey underline-offset-4 hover:text-ink hover:underline"
        >
          <FileText className="size-3.5" strokeWidth={1.6} />
          View CV
        </a>
        <span className="flex gap-1">
          {persona.courseLanguages.map((language) => (
            <span key={language} className="tag">
              {language === "en" ? "EN" : language === "ms" ? "BM" : "中文"}
            </span>
          ))}
        </span>
      </div>
    </motion.article>
  );
}
