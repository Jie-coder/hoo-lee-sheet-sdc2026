// Site footer: wordmark, short tagline, and the few links that apply everywhere.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#about", key: "footer.about" },
  { href: "/status", key: "footer.sources" },
  { href: "/#privacy", key: "footer.privacy" },
] as const;

export function SiteFooter() {
  const pathname = usePathname();
  const { t } = useT();
  // These routes keep a fixed EstimateFooter at the bottom of the viewport.
  const needsSpace = ["/results", "/pathway", "/radar"].some((route) => pathname.startsWith(route));

  return (
    <footer className={cn("border-t border-line", needsSpace && "pb-14")}>
      <div className="mx-auto grid max-w-[1248px] grid-cols-1 gap-7 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1.2fr] md:gap-12">
        <div>
          {/* Official wordmark. next/image refuses SVG without extra config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/laluan-logo.svg" alt="Laluan" className="h-7 w-auto" />
          <p className="mt-3.5 text-[14px] text-grey">{t("footer.tagline")}</p>
        </div>

        <nav className="flex flex-col gap-3 text-[14px] md:flex-row md:gap-7">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-ink hover:underline">
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div>
          <p className="text-[12.5px] leading-relaxed text-grey">{t("footer.disclaimer")}</p>
          <p className="mt-2.5 text-[12px] text-grey">© 2026 Laluan</p>
        </div>
      </div>
    </footer>
  );
}
