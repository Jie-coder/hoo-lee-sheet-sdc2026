// Printable Laluan Certificate of Completion. Reads the learner's saved
// progress from localStorage in the browser, so the server only passes down
// the course/programme titles and the fonts.
import type { Metadata } from "next";
import { Mrs_Saint_Delafield, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import { CertificateView } from "@/components/certificate-view";
import { CATALOGUE } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Certificate",
};

// Fonts follow the Canva PDF embedding table (see docs/programme-proof.md, Fonts).
const termes = localFont({
  src: "../../fonts/tex-gyre-termes/texgyretermes-regular.otf",
  weight: "400",
  display: "swap",
  fallback: ["Times New Roman", "Times", "serif"],
});
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });
// Temporary stand-in for Amsterdam One (Lettersiro, no web licence yet).
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
        fonts={{ termes: termes.style.fontFamily, poppins: poppins.style.fontFamily, script: script.style.fontFamily }}
      />
    </Suspense>
  );
}
