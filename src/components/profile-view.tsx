// Profile: pick a sample CV (or upload a synthetic one), then check and
// edit what was "read" from it before continuing to the interview.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Database,
  FileText,
  Info,
  MapPin,
  Plus,
  ScanText,
  TriangleAlert,
  Upload,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CourseLanguageToggle } from "@/components/course-language-toggle";
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

  useEffect(() => {
    if (hydrated && !consent) router.replace("/");
  }, [hydrated, consent, router]);

  function handleUploadFile() {
    startUploadProfile();
    toast.success("Mock parse complete — fill in or edit the details below.");
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
    <main className="mx-auto max-w-[1248px] px-4 pb-12 sm:px-6">
      <section className="flex flex-col gap-3 pt-7 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[13px] text-grey">Step 1 of 4 · Profile</p>
          <h1 className="mt-1 font-serif text-[30px] leading-[1.1] font-medium tracking-tight md:text-[36px]">
            Pick a sample CV
          </h1>
        </div>
        <p className="text-[13px] leading-relaxed text-grey md:max-w-[400px] md:text-right">
          These three people are fictional. Each one shows a different situation, so you can compare how Laluan
          responds.
        </p>
      </section>

      {/* 1. Persona cards */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PERSONA_IDS.map((id) => (
          <PersonaCard key={id} id={id} selected={profile?.personaId === id} onSelect={() => selectPersona(id)} />
        ))}
      </section>

      {/* 2. Upload (secondary) */}
      <section
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleUploadFile();
        }}
        className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-line bg-white/60 px-5 py-4 md:flex-row md:items-center"
      >
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alt">
            <Upload className="size-4 text-grey" strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-[14px] font-medium">Upload your own (synthetic only)</p>
            <p className="text-[13px] text-grey">
              Drop a PDF here or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="underline underline-offset-4"
              >
                browse
              </button>
              . PDF only, up to 2 MB.
            </p>
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
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-line bg-alt px-3 py-2 text-[12px] leading-relaxed text-ink md:max-w-[520px]">
          <TriangleAlert className="mt-px size-4 shrink-0" strokeWidth={1.6} />
          <span>
            <span className="font-medium">Do not upload a real CV.</span> This demo is for synthetic CVs only. Leave
            out real names, IC numbers, phone numbers and addresses.
          </span>
        </p>
      </section>

      {/* 3. Parsed profile */}
      {profile && (
        <section className="mt-5 rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-grey">
                {persona ? `READ FROM ${persona.name.toUpperCase()}'S CV` : "YOUR UPLOADED PROFILE"}
              </p>
              <h2 className="mt-1 font-serif text-[24px] font-medium tracking-tight">Check your skills</h2>
              <p className="mt-1 text-[13px] text-grey">
                Remove anything wrong and add what&rsquo;s missing. These chips feed your role fit.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 md:justify-end">
              {persona && (
                <span className="inline-flex items-center gap-1 rounded-md border border-line bg-alt px-2 py-0.5 text-[11px] leading-4 text-grey">
                  <Database className="size-3" strokeWidth={1.6} />
                  ESCO v1.2.1 · {matchedCount} of {profile.skills.length} skills matched
                </span>
              )}
              {persona && (
                <span className="inline-flex items-center gap-1 rounded-md border border-line bg-alt px-2 py-0.5 text-[11px] leading-4 text-grey">
                  <ScanText className="size-3" strokeWidth={1.6} />
                  Parsed {persona.parsedOn}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* name + skills */}
            <div className="md:col-span-8">
              <label className="block text-[12px] text-grey">
                Name
                <input
                  value={profile.name}
                  onChange={(event) => updateProfile({ name: event.target.value })}
                  placeholder="Your name"
                  className="mt-1 w-full max-w-sm rounded-md border border-line px-2.5 py-1.5 text-[14px] text-ink"
                />
              </label>

              <p className="mt-4 mb-2 text-[12px] text-grey">
                Skills and tools <span className="tabular-nums">({profile.skills.length})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-alt py-1 pr-1.5 pl-2.5 text-[13px]"
                  >
                    {skill.label}
                    {skill.selfReported && (
                      <span className="text-[10px] tracking-wide text-grey/80 uppercase">added</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${skill.label}`}
                      onClick={() => removeSkill(skill.id)}
                      className="text-grey hover:text-ink"
                    >
                      <X className="size-3.5" strokeWidth={1.6} />
                    </button>
                  </span>
                ))}
                {addingSkill ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-grey/50 py-1 pr-1.5 pl-2.5 text-[13px]">
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
                  <button
                    type="button"
                    onClick={() => setAddingSkill(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-grey/50 px-2.5 py-1 text-[13px] text-grey"
                  >
                    <Plus className="size-3.5" strokeWidth={1.6} />
                    Add a skill
                  </button>
                )}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-grey">
                <Info className="size-3.5 text-sage" strokeWidth={1.6} />
                Skills you add count as self-reported (half weight) until a course confirms them.
              </p>

              <p className="mt-6 mb-1.5 text-[12px] text-grey">Roles</p>
              <ul className="divide-y divide-line border-y border-line text-[13px]">
                {profile.roles.map((role, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2 py-2">
                    <input
                      value={role.title}
                      onChange={(event) => updateRole(index, { title: event.target.value })}
                      placeholder="Role title"
                      className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-0.5 hover:border-line focus:border-line focus:outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={role.years}
                      onChange={(event) => updateRole(index, { years: Number(event.target.value) })}
                      className="w-16 rounded-md border border-transparent px-1.5 py-0.5 text-right tabular-nums hover:border-line focus:border-line focus:outline-none"
                    />
                    <span className="text-grey">yrs</span>
                    <button
                      type="button"
                      aria-label={`Remove ${role.title || "role"}`}
                      onClick={() => removeRole(index)}
                      className="text-grey hover:text-ink"
                    >
                      <X className="size-3.5" strokeWidth={1.6} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={addRole} className="mt-2 flex items-center gap-1.5 text-[12px] text-grey">
                <Plus className="size-3.5" strokeWidth={1.6} />
                Add a role
              </button>
            </div>

            {/* education / languages */}
            <div className="space-y-4 text-[13px] md:col-span-4 md:border-l md:border-line md:pl-6">
              <div>
                <p className="mb-1.5 text-[12px] text-grey">Education</p>
                <ul className="space-y-2">
                  {profile.education.map((item, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-1.5">
                      <textarea
                        value={item.level}
                        onChange={(event) => updateEducation(index, { level: event.target.value })}
                        placeholder="Qualification"
                        rows={1}
                        className="field-sizing-content min-w-[8rem] flex-1 resize-none rounded-md border border-line px-1.5 py-1"
                      />
                      <textarea
                        value={item.field}
                        onChange={(event) => updateEducation(index, { field: event.target.value })}
                        placeholder="Institution"
                        rows={1}
                        className="field-sizing-content min-w-[8rem] flex-1 resize-none rounded-md border border-line px-1.5 py-1"
                      />
                      <button
                        type="button"
                        aria-label="Remove education entry"
                        onClick={() => removeEducation(index)}
                        className="text-grey hover:text-ink"
                      >
                        <X className="size-3.5" strokeWidth={1.6} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addEducation}
                  className="mt-2 flex items-center gap-1.5 text-[12px] text-grey"
                >
                  <Plus className="size-3.5" strokeWidth={1.6} />
                  Add education
                </button>
              </div>
              <div>
                <p className="mb-1.5 text-[12px] text-grey">
                  Preferred course language <span className="text-grey/80">(choose one or more)</span>
                </p>
                <CourseLanguageToggle value={profile.courseLanguages} onToggle={toggleCourseLanguage} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row">
            <p className="flex items-center gap-2 text-[13px] text-grey">
              Next: 5 quick questions about how you spend your week.
            </p>
            <button
              type="button"
              onClick={() => router.push("/interview")}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-5 py-2.5 text-[14px] font-medium text-white sm:w-auto"
            >
              Continue to interview
              <ArrowRight className="size-4" strokeWidth={1.6} />
            </button>
          </div>
        </section>
      )}

      <p className="mt-8 mb-6 border-t border-line pt-4 text-[11px] leading-relaxed text-grey/80">
        All three people and their CVs are synthetic, made for the SDC Hackathon demo. Their CV skills were matched
        to ESCO skills by hand (data/persona_skills.csv). A skill you add counts only when it is exactly an ESCO skill
        name, at half weight.
      </p>
    </main>
  );
}

function PersonaCard({
  id,
  selected,
  onSelect,
}: {
  id: PersonaId;
  selected: boolean;
  onSelect: () => void;
}) {
  const persona = PERSONAS[id];
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-white p-6",
        selected ? "border-sage-tint ring-1 ring-sage-tint/60" : "border-line",
      )}
    >
      <div className="flex items-center justify-between">
        {selected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-medium text-sage-dark">
            <Check className="size-3.5" strokeWidth={1.6} />
            Selected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-alt px-2.5 py-1 text-[12px] text-grey">
            <UserX className="size-3.5" strokeWidth={1.6} />
            Synthetic CV
          </span>
        )}
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full border border-line bg-alt text-[13px] font-medium text-grey"
        >
          {persona.initials}
        </span>
      </div>
      <h3 className="mt-4 font-serif text-[24px] leading-tight font-medium">
        {persona.name}
        {persona.nameLocal && (
          <span className="font-sans text-[18px] font-normal text-grey"> {persona.nameLocal}</span>
        )}
      </h3>
      <p className="mt-1 text-[14px]">
        Age <span className="tabular-nums">{persona.age}</span> · {persona.jobTitle}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-grey">
        <MapPin className="size-3.5" strokeWidth={1.6} />
        {persona.location}
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-grey">{persona.summary}</p>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-[12px] text-grey">Course language</span>
        <span className="flex gap-1">
          {persona.courseLanguages.map((language) => (
            <span key={language} className="rounded-md border border-line bg-white px-2 py-0.5 text-[12px]">
              {language === "en" ? "EN" : language === "ms" ? "BM" : "中文"}
            </span>
          ))}
        </span>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <a
          href={persona.cvUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          <FileText className="size-4" strokeWidth={1.6} />
          View CV
        </a>
        <div className="flex-1">
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[14px] font-medium",
              selected ? "bg-ink text-white" : "border border-line bg-btn2",
            )}
          >
            {selected && <Check className="size-4" strokeWidth={1.6} />}
            {selected ? "Using this CV" : "Use this CV"}
          </button>
        </div>
      </div>
    </article>
  );
}
