// Shared one-column layout for the footer pages (/about, /data-sources, /privacy),
// matching the /exposure explainer typography.
import type { ReactNode } from "react";

export function InfoPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-2xl px-5 py-12 text-[15px] leading-relaxed">
      <h1 className="font-serif text-[34px] leading-tight font-medium tracking-tight">{title}</h1>
      <p className="mt-3 text-grey">{lede}</p>
      {children}
    </article>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-[22px] font-medium">{heading}</h2>
      {children}
    </section>
  );
}
