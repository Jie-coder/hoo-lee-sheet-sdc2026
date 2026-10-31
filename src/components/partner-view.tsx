// /partner: how sponsored placement works, our rules, placeholder pricing and a
// demo application form. No network calls, no storage: submit only shows a
// client-side "Application received" ticket.
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Perforation } from "@/components/caldera";
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

function Ticket({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[28px] bg-card p-6 sm:p-7", className)}>
      <h2 className="font-serif text-[28px] leading-none uppercase">{title}</h2>
      <Perforation className="my-5" />
      {children}
    </section>
  );
}

export function PartnerView() {
  const { t } = useT();
  const [plan, setPlan] = useState<PlanId>("performance");
  const [org, setOrg] = useState("");
  const [url, setUrl] = useState("");
  const [skills, setSkills] = useState<SkillId[]>([]);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validatePartnerForm({ org, url, skills, email });
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(true);
  }

  function reset() {
    setOrg("");
    setUrl("");
    setSkills([]);
    setEmail("");
    setPlan("performance");
    setErrors({});
    setSubmitted(false);
  }

  const inputClass =
    "mt-1.5 w-full rounded-full border-[1.5px] border-ink/30 bg-paper px-4 py-2.5 text-[15px] focus-visible:border-ink focus-visible:outline-none";

  return (
    <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-20 sm:px-6 md:px-8">
      <section className="rounded-[40px] bg-plasma px-7 py-10 text-limestone md:px-14 md:py-14">
        <p className="font-data text-[12px] tracking-[0.06em] text-limestone/70 uppercase">{t("partner.eyebrow")}</p>
        <h1 className="mt-4 font-serif text-[clamp(40px,7vw,88px)] leading-[1] uppercase">{t("partner.title")}</h1>
        <p className="mt-4 max-w-[640px] text-[18px] leading-snug">{t("partner.lede")}</p>
        <p className="mt-3 font-data text-[12px] tracking-[0.04em] text-limestone/80 uppercase">{t("partner.principle")}</p>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Ticket title={t("partner.howTitle")}>
          <ol className="space-y-3 text-[15px] leading-snug">
            {(["partner.how1", "partner.how2", "partner.how3"] as const).map((key, i) => (
              <li key={key} className="flex gap-3">
                <span className="font-data text-[13px] text-grey">{String(i + 1).padStart(2, "0")}</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
        </Ticket>
        <Ticket title={t("partner.getTitle")}>
          <ul className="space-y-3 text-[15px] leading-snug">
            <li>{t("partner.get1")}</li>
            <li>{t("partner.get2")}</li>
          </ul>
          <div className="mt-4 rounded-[20px] border-[1.5px] border-dashed border-ink/30 p-4" data-testid="partner-insights">
            <p className="text-[15px] font-bold">{t("partner.insightsTitle")}</p>
            <p className="mt-1 font-data text-[11px] tracking-[0.04em] text-grey uppercase">{t("partner.insightsTag")}</p>
            <p className="mt-2 text-[13px] leading-snug text-grey">{t("partner.insightsBody")}</p>
          </div>
        </Ticket>
        <Ticket title={t("partner.rulesTitle")}>
          <ul className="space-y-3 text-[15px] leading-snug" data-testid="partner-rules">
            {(["partner.rule1", "partner.rule2", "partner.rule3", "partner.rule4"] as const).map((key) => (
              <li key={key} className="flex gap-2.5">
                <span aria-hidden>●</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </Ticket>
      </div>

      {submitted ? (
        <section className="mx-auto mt-12 max-w-[720px] rounded-[28px] bg-card p-6 sm:p-8" data-testid="partner-success" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-[clamp(28px,5vw,40px)] leading-none uppercase">{t("partner.success.title")}</h2>
            <span className="rounded-full bg-sulfur px-2.5 py-0.5 font-data text-[12px] tracking-[0.06em] text-ink uppercase">
              {t("partner.success.demoTag")}
            </span>
          </div>
          <Perforation className="my-5" />
          <dl className="grid gap-3 text-[15px] sm:grid-cols-[180px_1fr]">
            <dt className="font-data text-[12px] tracking-[0.04em] text-grey uppercase">{t("partner.form.org")}</dt>
            <dd className="font-bold break-words">{org}</dd>
            <dt className="font-data text-[12px] tracking-[0.04em] text-grey uppercase">{t("partner.form.url")}</dt>
            <dd className="break-all">{url}</dd>
            <dt className="font-data text-[12px] tracking-[0.04em] text-grey uppercase">{t("partner.form.skills")}</dt>
            <dd>{skills.map((id) => t(`partner.skill.${id}`)).join(", ")}</dd>
            <dt className="font-data text-[12px] tracking-[0.04em] text-grey uppercase">{t("partner.form.email")}</dt>
            <dd className="break-all">{email}</dd>
            <dt className="font-data text-[12px] tracking-[0.04em] text-grey uppercase">{t("partner.form.plan")}</dt>
            <dd>{t(`partner.plan.${plan}.name`)}</dd>
          </dl>
          <Perforation className="my-5" />
          <p className="text-[15px] leading-snug">{t("partner.success.next")}</p>
          <p className="mt-3 text-[12px] text-grey">{t("partner.success.demoNote")}</p>
          <button type="button" onClick={reset} className="btn-secondary mt-5">
            {t("partner.success.again")}
          </button>
        </section>
      ) : (
        <>
          <section className="mt-12">
            <h2 className="font-serif text-[clamp(32px,5vw,48px)] leading-none uppercase">{t("partner.pricingTitle")}</h2>
            <p className="mt-2 text-[14px] text-grey">{t("partner.pricingNote")}</p>
            <div role="radiogroup" aria-label={t("partner.form.plan")} className="mt-5 grid gap-4 sm:grid-cols-2">
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
                      "rounded-[28px] bg-card p-6 text-left ring-ink transition-shadow",
                      selected ? "ring-[2.5px]" : "ring-1 ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-data text-[11px] tracking-[0.06em] text-grey uppercase">{t("partner.plan.example")}</span>
                      {selected && (
                        <span className="rounded-full bg-ink px-2.5 py-0.5 font-data text-[11px] tracking-[0.06em] text-paper uppercase">
                          {t("partner.plan.selected")}
                        </span>
                      )}
                    </span>
                    <span className="mt-3 block text-[20px] leading-tight font-bold">{t(`partner.plan.${id}.name`)}</span>
                    <span className="mt-2 block text-[14px] leading-snug text-grey">{t(`partner.plan.${id}.body`)}</span>
                    <span className="mt-4 block font-data text-[20px] tracking-[0.04em]">{t("partner.plan.price")}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-12 max-w-[720px]">
            <h2 className="font-serif text-[clamp(32px,5vw,48px)] leading-none uppercase">{t("partner.formTitle")}</h2>
            <form noValidate onSubmit={onSubmit} className="mt-5 space-y-5 rounded-[28px] bg-card p-6 sm:p-8" data-testid="partner-form">
              <Field id="p-org" label={t("partner.form.org")} error={errors.org && t(errors.org)}>
                <input id="p-org" value={org} onChange={(e) => setOrg(e.target.value)} className={inputClass} aria-invalid={!!errors.org} />
              </Field>
              <Field id="p-url" label={t("partner.form.url")} error={errors.url && t(errors.url)}>
                <input
                  id="p-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={inputClass}
                  aria-invalid={!!errors.url}
                />
              </Field>
              <fieldset>
                <legend className="text-[14px] font-bold">{t("partner.form.skills")}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PARTNER_SKILLS.map((id) => {
                    const on = skills.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSkills((cur) => (on ? cur.filter((s) => s !== id) : [...cur, id]))}
                        className={cn(
                          "rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] transition-colors",
                          on ? "border-ink bg-ink text-paper" : "border-ink/30 text-ink hover:border-ink",
                        )}
                      >
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
              <p className="text-[13px] text-grey">
                {t("partner.form.plan")}: <span className="font-bold text-ink">{t(`partner.plan.${plan}.name`)}</span>
              </p>
              <button type="submit" className="w-full rounded-full bg-obsidian px-6 py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 sm:w-auto">
                {t("partner.form.submit")}
              </button>
              <p className="text-[12px] text-grey">{t("partner.success.demoNote")}</p>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string | false; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-bold">
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
