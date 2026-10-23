// Root layout: Laluan fonts, paper theme, app header, and toasts.
import type { Metadata } from "next";
import { Anton, DM_Sans, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FlowProvider } from "@/context/flow-context";
import { LocaleProvider } from "@/lib/i18n";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Chinese course names and the 中文 course-language label fall through Inter
// to this face. Preload stays off: the CJK files are large and only needed
// when those glyphs appear.
const notoSansSc = Noto_Sans_SC({
  // 400 body + 700 to match bold DM Sans titles (adding 500 breaks the Turbopack font fetch).
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-noto-sans-sc",
  fallback: ["Noto Sans CJK SC", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Laluan",
    template: "%s · Laluan",
  },
  description:
    "Laluan reads a CV, scores how AI touches the work, and supports a reskilling decision. It does not make hiring decisions.",
  icons: {
    icon: [
      { url: "/brand/laluan-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/laluan-favicon.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${dmSans.variable} ${notoSansSc.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <FlowProvider>
          <LocaleProvider>
            <TooltipProvider>
              <SiteHeader />
              <main className="flex flex-1 flex-col [&>*]:w-full">{children}</main>
              <SiteFooter />
              <Toaster />
            </TooltipProvider>
          </LocaleProvider>
        </FlowProvider>
      </body>
    </html>
  );
}
