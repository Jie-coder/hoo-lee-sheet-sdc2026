// Site footer: wordmark, short tagline, and the few links that apply everywhere.
"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export const FOOTER_LINKS = [
  { href: "/about", key: "footer.about" },
  { href: "/data-sources", key: "footer.sources" },
  { href: "/privacy", key: "footer.privacy" },
] as const;

export function SiteFooter() {
  const { t } = useT();

  return (
    <footer className="border-t border-[rgba(244,241,234,0.15)] bg-black text-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1248px] grid-cols-1 gap-7 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1.2fr] md:gap-12">
        <div>
          {/* Official wordmark. next/image refuses SVG without extra config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/laluan-logo.svg" alt="Laluan" className="h-7 w-auto brightness-0 invert" />
          <p className="mt-3.5 text-[14px] text-[#F4F1EA]/70">{t("footer.tagline")}</p>
        </div>

        <nav className="flex flex-col gap-3 text-[14px] md:flex-row md:gap-7">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-[#F4F1EA]/70 transition-colors hover:text-sage-tint hover:underline focus-visible:text-sage-tint">
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div>
          <p className="text-[12.5px] leading-relaxed text-[#F4F1EA]/70">{t("footer.disclaimer")}</p>
          <p className="mt-2.5 text-[12px] text-[#F4F1EA]/70">© 2026 Laluan</p>
        </div>
      </div>
    </footer>
  );
}
