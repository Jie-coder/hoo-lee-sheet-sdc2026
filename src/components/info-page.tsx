// Shared one-column layout for the footer pages (/about, /data-sources, /privacy),
// matching the /exposure explainer typography.
import type { ReactNode } from "react";

export function InfoPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[720px] px-5 pt-16 pb-16 text-[15px] md:pt-24 leading-relaxed">
      <h1 className="font-heading text-[52px] leading-[0.95] uppercase md:text-[80px]">{title}</h1>
      <p className="mt-5 text-[17px] text-grey">{lede}</p>
      {children}
    </article>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="font-serif text-[22px] font-medium">{heading}</h2>
      {children}
    </section>
  );
}
