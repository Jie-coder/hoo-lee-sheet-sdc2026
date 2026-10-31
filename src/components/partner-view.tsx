// /partner (mock v2): how sponsored placement works, our rules, demo pricing
// (fictional, disclosed in docs/PARTNER_DEMO.md) and a demo application form. No network calls, no storage: submit only shows a
// client-side "Application received" ticket.
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { LandingHeroCanvas } from "@/components/landing-hero-canvas";
import { SponsoredCard } from "@/components/sponsored-card";
import { SPONSORED_COURSES } from "@/lib/sponsored";
import { useT, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const PARTNER_SKILLS = ["data", "programming", "ai", "digital", "business", "design", "communication"] as const;
export const PARTNER_PLANS = ["performance", "bundle"] as const;
type SkillId = (typeof PARTNER_SKILLS)[number];
type PlanId = (typeof PARTNER_PLANS)[number];

type Errors = Partial<Record<"org" | "url" | "skills" | "email", MessageKey>>;

export function validatePartnerForm(values: { org: string; url: string; skills: readonly string[]; email: string }): Errors {
  const errors: Errors = {};
  if (!values.org.trim()) errors.org = "partner.form.errOrg";
  try {
    const parsed = new URL(values.url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") errors.url = "partner.form.errUrl";
  } catch {
    errors.url = "partner.form.errUrl";
  }
  if (values.skills.length === 0) errors.skills = "partner.form.errSkills";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "partner.form.errEmail";
  return errors;
}

const PREFILL = {
  org: "Draviqen Academy",
  url: "https://example.my/courses/dashboards",
  email: "partners@example.my",
  skills: ["data"] as SkillId[],
};

const HERO_PREVIEW = SPONSORED_COURSES.find((course) => course.id === "spn-002") ?? SPONSORED_COURSES[0];

const kicker = "font-data text-[12px] tracking-[0.06em] text-grey uppercase";
const sectionTitle = "font-serif text-[36px] leading-[0.95] uppercase md:text-[44px]";
const mono = "font-data tracking-[0.06em] uppercase";

export function PartnerView() {
  const { t } = useT();
  const [plan, setPlan] = useState<PlanId>("performance");
  const [org, setOrg] = useState(PREFILL.org);
  const [url, setUrl] = useState(PREFILL.url);
  const [skills, setSkills] = useState<SkillId[]>(PREFILL.skills);
  const [email, setEmail] = useState(PREFILL.email);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validatePartnerForm({ org, url, skills, email });
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(true);
  }

  function reset() {
    setOrg(PREFILL.org);
    setUrl(PREFILL.url);
    setSkills(PREFILL.skills);
    setEmail(PREFILL.email);
    setPlan("performance");
    setErrors({});
    setSubmitted(false);
  }

  const inputClass =
    "w-full rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] focus-visible:border-plasma focus-visible:shadow-[0_0_0_4px_rgba(82,74,233,0.18)] focus-visible:outline-none";

  return (
    <main className="mx-auto max-w-[1264px] px-4 pt-2 pb-10 sm:px-8">
      <section className="mt-2 grid overflow-hidden rounded-[28px] bg-plasma text-limestone md:min-h-[440px] md:grid-cols-[1.05fr_1fr] md:rounded-[40px]">
        <div className="px-6 pt-8 pb-2 md:p-14">
          <p className={cn(mono, "text-[12px] opacity-75")}>{t("partner.eyebrow")}</p>
          <h1 className="mt-[18px] mb-5 font-serif text-[60px] leading-[0.95] uppercase md:text-[96px]">{t("partner.title")}</h1>
          <p className="max-w-[420px] text-[17px] leading-[1.35] md:text-[19px]">{t("partner.lede")}</p>
          <p className={cn(mono, "mt-7 inline-flex items-center gap-2 rounded-full border-[1.5px] border-limestone/45 px-3.5 py-2 text-[11px]")}>
            ◆ {t("partner.principle")}
          </p>
        </div>
        <div className="relative flex min-h-[340px] items-center justify-center px-4 pt-6 pb-12 md:min-h-0 md:p-0" data-testid="partner-hero-preview">
          {/* Same halftone texture as the home hero, decorative only. */}
          <LandingHeroCanvas className="absolute inset-0 size-full" />
          <div className="relative w-[calc(100%-32px)] max-w-[320px] -rotate-2 rounded-[24px] shadow-[0_24px_50px_rgba(7,6,7,0.35)] md:max-w-[330px]">
            <SponsoredCard
              t={t}
              course={HERO_PREVIEW}
              skillLabel={HERO_PREVIEW.skillLabel}
              corner={t("sponsored.altStop", { n: "02" })}
              withWhy={false}
              className="sponsored-card--flat"
            />
          </div>
        </div>
      </section>

      <section className="mt-[52px] md:mt-[72px]">
        <p className={kicker}>{t("partner.kicker.process")}</p>
        <h2 className={cn(sectionTitle, "mt-2.5")}>{t("partner.howTitle")}</h2>
        <ol className="relative mt-6 grid gap-4 md:grid-cols-3">
          {(["partner.how1", "partner.how2", "partner.how3"] as const).map((key, i) => (
            <li key={key} className="flex gap-4 rounded-[24px] bg-card p-5 md:block md:p-[26px]">
              <span className="font-serif text-[44px] leading-none text-plasma">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-[15.5px] leading-[1.45] md:mt-2.5">{t(key)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-[52px] md:mt-[72px]">
        <p className={kicker}>{t("partner.kicker.trust")}</p>
        <h2 className={cn(sectionTitle, "mt-2.5")}>{t("partner.rulesSection")}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="relative rounded-[28px] border-2 border-plasma bg-card p-[30px]">
            <span className={cn(mono, "absolute -top-[13px] left-[26px] rounded-full bg-plasma px-3 py-[5px] text-[10.5px] text-white")}>
              {t("partner.rulesBadge")}
            </span>
            <h3 className="font-serif text-[30px] leading-none uppercase">{t("partner.rulesTitle")}</h3>
            <ul className="mt-5 grid gap-x-[26px] gap-y-[18px] sm:grid-cols-2" data-testid="partner-rules">
              {(
                [
                  ["S", "partner.rule1"],
                  ["1", "partner.rule2"],
                  ["✓", "partner.rule3"],
                  ["=", "partner.rule4"],
                ] as const
              ).map(([icon, key]) => (
                <li key={key} className="flex gap-3 text-[15.5px] leading-[1.4] font-medium">
                  <span aria-hidden className="grid size-[30px] flex-none place-items-center rounded-full bg-plasma/12 font-data text-[13px] text-plasma">
                    {icon}
                  </span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] bg-card p-[30px]">
            <h3 className="font-serif text-[30px] leading-none uppercase">{t("partner.getTitle")}</h3>
            <ul className="mt-[18px] text-[15.5px] leading-[1.45]">
              <li className="border-b border-line py-2.5">{t("partner.get1")}</li>
              <li className="py-2.5">{t("partner.get2")}</li>
            </ul>
            <div className="mt-[18px] rounded-[18px] border-[1.5px] border-dashed border-ink/30 p-4" data-testid="partner-insights">
              <p>
                <b className="text-[15px]">{t("partner.insightsTitle")}</b>{" "}
                <span className={cn(mono, "ml-1.5 text-[10.5px] text-grey")}>{t("partner.insightsTag")}</span>
              </p>
              <p className="mt-1.5 text-[13px] leading-[1.45] text-grey">{t("partner.insightsBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {submitted ? (
        <section
          className="mx-auto mt-[52px] grid max-w-[820px] md:mt-[72px] md:grid-cols-[1fr_220px]"
          data-testid="partner-success"
          aria-live="polite"
        >
          <div className="rounded-t-[28px] bg-card p-[26px] md:rounded-l-[28px] md:rounded-tr-none md:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-[40px] leading-[0.95] uppercase md:text-[52px]">{t("partner.success.title")}</h2>
              <span className={cn(mono, "rounded-[6px] bg-sulfur px-[9px] py-[3px] text-[12px] text-ink")}>{t("partner.success.demoTag")}</span>
            </div>
            <div aria-hidden className="mt-[22px] border-t-[1.5px] border-dashed border-ink/25" />
            <dl className="mt-[22px] grid gap-x-4 gap-y-1 text-[15px] sm:grid-cols-[150px_1fr] sm:gap-y-3">
              {(
                [
                  ["partner.form.org", org],
                  ["partner.form.url", url],
                  ["partner.form.skills", skills.map((id) => t(`partner.skill.${id}`)).join(", ")],
                  ["partner.form.email", email],
                  ["partner.form.plan", t(`partner.plan.${plan}.name`)],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className={cn(mono, "pt-[3px] text-[11px] text-grey")}>{t(key)}</dt>
                  <dd className="mb-2 break-words sm:mb-0">{value}</dd>
                </div>
              ))}
            </dl>
            <div aria-hidden className="mt-[22px] mb-4 border-t-[1.5px] border-dashed border-ink/25" />
            <p className="text-[14.5px] leading-normal text-grey">{t("partner.success.next")}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className={cn(mono, "text-[11px]")}>{t("partner.success.demoNote")}</p>
              <button type="button" onClick={reset} className="btn-secondary">
                {t("partner.success.again")}
              </button>
            </div>
          </div>
          <div className="relative flex flex-col justify-between gap-6 rounded-b-[28px] bg-plasma px-[26px] py-[30px] text-limestone md:rounded-r-[28px] md:rounded-bl-none">
            <span aria-hidden className="absolute inset-x-5 -top-px border-t-2 border-dashed border-limestone/60 md:inset-x-auto md:inset-y-5 md:-left-px md:border-t-0 md:border-l-2" />
            <div>
              <p className={cn(mono, "text-[10.5px] opacity-75")}>{t("partner.success.stubEyebrow")}</p>
              <p className="mt-2 font-serif text-[34px] leading-[0.95] uppercase">{t("partner.success.stubTitle")}</p>
            </div>
            <div>
              <p className={cn(mono, "mb-2.5 text-[10.5px] opacity-75")}>{t("partner.success.demoTag")}</p>
              <div
                aria-hidden
                className="h-14 bg-[repeating-linear-gradient(90deg,#f7f6f2_0_2px,transparent_2px_5px,#f7f6f2_5px_6px,transparent_6px_9px)]"
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-[52px] md:mt-[72px]">
            <p className={kicker}>{t("partner.kicker.pricing")}</p>
            <h2 className={cn(sectionTitle, "mt-2.5")}>{t("partner.pricingTitle")}</h2>
            <p className="mt-2 text-grey">{t("partner.pricingNote")}</p>
            <div role="radiogroup" aria-label={t("partner.form.plan")} className="mt-6 grid gap-4 md:grid-cols-2">
              {PARTNER_PLANS.map((id) => {
                const selected = plan === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlan(id)}
                    className={cn(
                      "relative rounded-[28px] border-2 bg-card text-left transition-shadow focus-visible:shadow-[0_0_0_4px_rgba(82,74,233,0.18)] focus-visible:outline-none",
                      selected ? "border-ink shadow-[0_0_0_4px_rgba(82,74,233,0.25)]" : "border-transparent hover:border-ink/30",
                    )}
                  >
                    <span className="block px-7 pt-[26px] pb-[22px]">
                      <span className="flex items-center justify-between gap-3">
                        <span className={cn(mono, "text-[11px] text-grey")}>{t(`partner.plan.${id}.tier`)}</span>
                        <span className="flex items-center gap-2">
                          {selected && (
                            <span className={cn(mono, "rounded-full bg-ink px-2.5 py-1 text-[10.5px] text-white")}>{t("partner.plan.selected")}</span>
                          )}
                          <span aria-hidden className="grid size-[22px] place-items-center rounded-full border-2 border-ink">
                            {selected && <span className="size-2.5 rounded-full bg-ink" />}
                          </span>
                        </span>
                      </span>
                      <span className="mt-2.5 block font-serif text-[30px] leading-[0.95] uppercase">{t(`partner.plan.${id}.name`)}</span>
                      <span className="mt-2 block text-[15px] leading-[1.4] text-grey">{t(`partner.plan.${id}.body`)}</span>
                    </span>
                    <span aria-hidden className="relative mx-7 block border-t-[1.5px] border-dashed border-ink/25">
                      <span className="absolute -top-[15px] -left-[45px] size-7 rounded-full bg-paper" />
                      <span className="absolute -top-[15px] -right-[45px] size-7 rounded-full bg-paper" />
                    </span>
                    <span className="block px-7 pt-5 pb-6 font-serif text-[26px] tracking-[0.02em]">{t(`partner.plan.${id}.price`)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-[52px] md:mt-[72px]">
            <p className={kicker}>{t("partner.kicker.apply")}</p>
            <form noValidate onSubmit={onSubmit} className="mt-6 grid md:grid-cols-[280px_1fr]" data-testid="partner-form">
              <div className="relative flex flex-col justify-between rounded-t-[28px] bg-obsidian p-6 text-limestone md:rounded-l-[28px] md:rounded-tr-none md:p-[30px]">
                <span aria-hidden className="absolute inset-x-6 -bottom-px border-b-2 border-dashed border-limestone/50 md:inset-x-auto md:inset-y-6 md:-right-px md:border-r-2 md:border-b-0" />
                <div>
                  <p className={cn(mono, "text-[11px] opacity-70")}>{t("partner.formStub")}</p>
                  <h2 className="mt-2.5 font-serif text-[36px] leading-[0.95] uppercase md:text-[44px]">{t("partner.formTitle")}</h2>
                </div>
                <p className={cn(mono, "mt-5 text-[10.5px] opacity-70")}>{t("partner.formDemo")}</p>
              </div>
              <div className="grid gap-x-[22px] gap-y-5 rounded-b-[28px] bg-card p-6 md:grid-cols-2 md:rounded-r-[28px] md:rounded-bl-none md:px-[34px] md:py-[30px]">
                <Field id="p-org" label={t("partner.form.org")} error={errors.org && t(errors.org)}>
                  <input id="p-org" value={org} onChange={(e) => setOrg(e.target.value)} className={inputClass} aria-invalid={!!errors.org} />
                </Field>
                <Field id="p-email" label={t("partner.form.email")} error={errors.email && t(errors.email)}>
                  <input
                    id="p-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    aria-invalid={!!errors.email}
                  />
                </Field>
                <Field id="p-url" label={t("partner.form.url")} error={errors.url && t(errors.url)} className="md:col-span-2">
                  <input id="p-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} aria-invalid={!!errors.url} />
                </Field>
                <fieldset className="md:col-span-2">
                  <legend className={cn(mono, "mb-2 text-[11px] text-grey")}>{t("partner.form.skills")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {PARTNER_SKILLS.map((id) => {
                      const on = skills.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSkills((cur) => (on ? cur.filter((s) => s !== id) : [...cur, id]))}
                          className={cn(
                            "rounded-full border-[1.5px] px-3.5 py-2 text-[14px] transition-colors focus-visible:shadow-[0_0_0_4px_rgba(82,74,233,0.18)] focus-visible:outline-none",
                            on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink",
                          )}
                        >
                          {on && <span aria-hidden>✓ </span>}
                          {t(`partner.skill.${id}`)}
                        </button>
                      );
                    })}
                  </div>
                  {errors.skills && (
                    <p role="alert" className="mt-1.5 text-[12px] text-grey">
                      {t(errors.skills)}
                    </p>
                  )}
                </fieldset>
                <div className="flex flex-col items-stretch gap-3.5 border-t-[1.5px] border-dashed border-ink/25 pt-[18px] sm:flex-row sm:items-center sm:justify-between md:col-span-2">
                  <p className="text-[14px]">
                    <span className={cn(mono, "text-[11px] text-grey")}>{t("partner.form.plan")}</span>&nbsp; {t(`partner.plan.${plan}.name`)}
                  </p>
                  <button
                    type="submit"
                    className="rounded-full bg-obsidian px-[26px] py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:shadow-[0_0_0_4px_rgba(82,74,233,0.18)] focus-visible:outline-none"
                  >
                    {t("partner.form.submit")} →
                  </button>
                </div>
              </div>
            </form>
          </section>
        </>
      )}

      <p className={cn(mono, "mt-[72px] text-center text-[11px] text-grey")}>{t("partner.footer")}</p>
    </main>
  );
}

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | false;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block font-data text-[11px] tracking-[0.06em] text-grey uppercase">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] text-grey">
          {error}
        </p>
      )}
    </div>
  );
}
