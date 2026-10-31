// Printable Laluan Certificate of Completion. Reads the learner's saved
// progress from localStorage in the browser, so the server only passes down
// the course/programme titles and the fonts.
import type { Metadata } from "next";
import { Mrs_Saint_Delafield, Newsreader, Poppins } from "next/font/google";
import { Suspense } from "react";
import { CertificateView } from "@/components/certificate-view";
import { CATALOGUE } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Certificate",
};

const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const script = Mrs_Saint_Delafield({ subsets: ["latin"], weight: "400", display: "swap" });

export default function CertificatePage() {
  const titles: Record<string, string> = {
    ...Object.fromEntries(CATALOGUE.courses.map((course) => [course.id, course.title])),
    ...Object.fromEntries(CATALOGUE.programmes.map((programme) => [programme.id, programme.name])),
  };
  return (
    <Suspense>
      <CertificateView
        titles={titles}
        fonts={{ serif: newsreader.style.fontFamily, sans: poppins.style.fontFamily, script: script.style.fontFamily }}
      />
    </Suspense>
  );
}
