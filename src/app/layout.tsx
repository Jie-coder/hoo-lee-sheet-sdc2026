// Root layout: Laluan fonts, paper theme, app header, and toasts.
import type { Metadata } from "next";
import { Geist_Mono, Inter, Newsreader, Noto_Sans_SC } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

// Chinese course names and the 中文 course-language label fall through Inter
// to this face. Preload stays off: the CJK files are large and only needed
// when those glyphs appear.
const notoSansSc = Noto_Sans_SC({
  weight: "400",
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} ${notoSansSc.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
