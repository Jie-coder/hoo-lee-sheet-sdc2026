// Laluan Certificate of Completion: a letter-landscape sheet that lists only
// courses whose certificate link passed the AI-assisted check. Layout mirrors
// docs/design/laluan-digital-cert-final.png. Sizes use container units (cqw) so
// the sheet looks the same on screen and in print. No QR code, no verification ID.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useFlow } from "@/context/flow-context";
import {
  cleanLearnerName,
  formatCertificateDate,
  loadCertificateName,
  saveCertificateName,
  verifiedCourseTitles,
} from "@/lib/certificate";
import { useT } from "@/lib/i18n";
import { loadProgress, verifiedItemIds } from "@/lib/programme-progress";

const PEACH = "#F4CDAE";
const ORANGE = "#EC7A2B";
const INK = "#4A4A4A";

type Fonts = { termes: string; poppins: string; script: string };

export function CertificateView({ titles, fonts }: { titles: Readonly<Record<string, string>>; fonts: Fonts }) {
  const { t } = useT();
  const { hydrated, profile, chosenRoleId } = useFlow();
  const roleId = useSearchParams().get("role") ?? chosenRoleId;

  // localStorage is read after mount so SSR and the first client render agree.
  const [courses, setCourses] = useState<string[] | null>(null);
  const [issuedOn, setIssuedOn] = useState<Date | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read persisted data after hydration */
    setCourses(roleId ? verifiedCourseTitles(verifiedItemIds(loadProgress(roleId)), titles) : []);
    setSavedName(loadCertificateName());
    setIssuedOn(new Date());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [roleId, titles]);

  const name = savedName ?? cleanLearnerName(profile?.name ?? "");

  if (!hydrated || courses === null || issuedOn === null) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <p className="text-[14px] text-grey" aria-live="polite">
          {t("certificatePage.loading")}
        </p>
      </div>
    );
  }

  const backHref = roleId ? `/pathway?role=${encodeURIComponent(roleId)}` : "/pathway";
  const backLink = (
    <Link href={backHref} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-grey hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={1.6} />
      {t("certificatePage.back")}
    </Link>
  );

  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        {backLink}
        <p className="mt-6 rounded-[28px] bg-card p-6 text-[14px]" data-testid="certificate-not-eligible">
          {t("certificatePage.notEligible")}
        </p>
      </div>
    );
  }

  function commitName() {
    const clean = cleanLearnerName(draft);
    if (!clean) return;
    saveCertificateName(clean);
    setSavedName(clean);
    setEditing(false);
  }

  const nameForm = (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        commitName();
      }}
    >
      <label className="sr-only" htmlFor="certificate-name">
        {t("certificatePage.nameLabel")}
      </label>
      <input
        id="certificate-name"
        type="text"
        autoComplete="name"
        maxLength={120}
        value={draft}
        placeholder={t("certificatePage.nameLabel")}
        onChange={(event) => setDraft(event.target.value)}
        className="min-w-0 flex-1 rounded-full border-[1.5px] border-ink/30 bg-paper px-4 py-2 text-[14px] sm:max-w-sm"
      />
      <button type="submit" disabled={!cleanLearnerName(draft)} className="btn-secondary shrink-0">
        {t("certificatePage.nameSave")}
      </button>
    </form>
  );

  const showForm = !name || editing;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      {/* Letter landscape, no margins: the sheet fills the printed page. */}
      <style>{`@page { size: letter landscape; margin: 0; }`}</style>
      <div className="print-hide">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {backLink}
          {name && (
            <div className="flex flex-wrap items-center gap-3">
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(name);
                    setEditing(true);
                  }}
                  className="text-[13px] text-grey underline underline-offset-4 hover:text-ink"
                >
                  {t("certificatePage.nameEdit")}
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink px-5 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                <Printer className="size-4" strokeWidth={1.6} />
                {t("certificatePage.print")}
              </button>
            </div>
          )}
        </div>
        {!name && <p className="mt-6 text-[14px]">{t("certificatePage.namePrompt")}</p>}
        {showForm && nameForm}
      </div>

      {name && (
        <Sheet fonts={fonts} name={name} courses={courses} dateText={formatCertificateDate(issuedOn)} />
      )}
    </div>
  );
}

function Sheet({ fonts, name, courses, dateText }: { fonts: Fonts; name: string; courses: string[]; dateText: string }) {
  const crowded = courses.length > 6;
  return (
    <section
      aria-label="Certificate of Completion"
      className="cert-sheet relative mx-auto mt-6 overflow-hidden"
      style={{
        containerType: "inline-size",
        width: "100%",
        aspectRatio: "11 / 8.5",
        background: "#FDFBF8",
        color: INK,
        fontFamily: fonts.poppins,
        fontWeight: 400,
        boxShadow: "0 1px 12px rgba(20,20,19,0.12)",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <style>{`
        @media print {
          header, footer, nav { display: none !important; }
          body:has(.cert-sheet) * { visibility: hidden !important; }
          body:has(.cert-sheet) .cert-sheet, body:has(.cert-sheet) .cert-sheet * { visibility: visible !important; }
          .cert-sheet { position: fixed !important; inset: 0 auto auto 0 !important; width: 11in !important; height: 8.5in !important; margin: 0 !important; box-shadow: none !important; }
          .cert-border { display: block !important; box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Double peach border */}
      <div aria-hidden className="absolute cert-border" style={{ inset: "2.2cqw", border: `max(2px, 0.28cqw) solid ${PEACH}` }} />
      <div aria-hidden className="absolute cert-border" style={{ inset: "2.9cqw", border: `max(1px, 0.1cqw) solid ${PEACH}` }} />

      {/* Winding road, lower left */}
      <svg
        aria-hidden
        viewBox="0 0 400 300"
        className="absolute"
        style={{ left: "3%", bottom: "4%", width: "40%", opacity: 0.5 }}
        fill="none"
        stroke={PEACH}
        strokeLinecap="round"
      >
        <path d="M10 40 C90 50 150 60 150 110 C150 170 60 170 30 230 C10 270 40 290 70 300" strokeWidth="1.6" />
        <path d="M30 40 C100 52 130 70 120 115 C112 160 30 180 40 240" strokeWidth="1.4" />
        <path d="M55 150 C70 200 150 210 220 250 C260 270 300 285 330 292" strokeWidth="1.4" strokeDasharray="6 5" />
        <path d="M100 105 C130 150 190 180 260 215 C300 235 340 255 380 275" strokeWidth="1.2" strokeDasharray="3 6" />
        <path d="M60 120 C60 190 140 220 190 270" strokeWidth="1.4" />
        <path d="M80 110 C75 180 150 230 230 285" strokeWidth="1" strokeDasharray="5 6" />
      </svg>

      {/* Logo + issuer */}
      <div className="absolute" style={{ left: "7.2%", top: "8.5%" }}>
        <div className="flex items-center" style={{ gap: "1.2cqw" }}>
          <svg aria-hidden viewBox="0 0 100 100" style={{ width: "5.8cqw", height: "5.8cqw" }}>
            <rect x="2" y="2" width="96" height="96" rx="14" fill={ORANGE} />
            <path
              d="M18 86 C18 66 62 66 44 50 C28 38 34 30 70 22 L80 28 C50 36 52 40 64 50 C86 66 50 70 52 86 Z"
              fill="#FDFBF8"
            />
            <path
              d="M35 86 C36 68 74 66 54 50 C40 38 50 32 75 25"
              fill="none"
              stroke={ORANGE}
              strokeWidth="1.8"
              strokeDasharray="5 4"
            />
          </svg>
          <span style={{ color: ORANGE, fontWeight: 700, fontSize: "6.2cqw", lineHeight: 1, letterSpacing: "-0.01em" }}>Laluan</span>
        </div>
        <p style={{ marginTop: "0.5cqw", marginLeft: "6.9cqw", fontSize: "1.45cqw" }}>Issued by Laluan · Team Hoo Lee Sheet</p>
      </div>

      {/* Title */}
      <h1
        className="absolute inset-x-0 text-center uppercase"
        style={{ top: "22.5%", fontFamily: fonts.termes, fontWeight: 400, fontSize: "3.7cqw", letterSpacing: "0.04em", lineHeight: 1.1 }}
      >
        Certificate of Completion
      </h1>
      <div aria-hidden className="absolute" style={{ top: "34.5%", left: "32%", width: "35%", height: 0, borderTop: `0.12cqw solid ${PEACH}` }} />

      {/* Body */}
      <div className="absolute inset-x-0 text-center" style={{ top: "38%" }}>
        <p style={{ fontSize: "1.65cqw" }}>This is to certify that</p>
        <p style={{ marginTop: "1.3cqw", fontSize: "3.1cqw", fontWeight: 500, lineHeight: 1.15, padding: "0 8cqw" }}>{name}</p>
        <p style={{ marginTop: "1.4cqw", fontSize: "1.65cqw" }}>has completed the following course(s) on the Laluan platform</p>
        <ul
          style={{ display: "table", margin: "1.5cqw auto 0", textAlign: "left", fontSize: crowded ? "1.5cqw" : "2cqw", lineHeight: crowded ? 1.5 : 1.6, listStylePosition: "inside", listStyleType: "disc", padding: 0 }}
        >
          {courses.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
        <p style={{ marginTop: crowded ? "1.2cqw" : "2.2cqw", fontSize: "1.65cqw" }}>{dateText}</p>
      </div>

      {/* Signature */}
      <div className="absolute text-center" style={{ right: "9.5%", bottom: "13.5%", width: "23%" }}>
        <p
          style={{
            // Amsterdam One is not bundled (personal-use licence); used only if installed locally.
            fontFamily: `"Amsterdam One", ${fonts.script}, "Snell Roundhand", "Brush Script MT", cursive`,
            fontSize: "6cqw",
            lineHeight: 1,
            color: "#141413",
            transform: "rotate(-3deg)",
          }}
        >
          H.LSheet
        </p>
        <div style={{ borderTop: `0.18cqw solid ${PEACH}`, marginTop: "0.4cqw" }} />
        <p style={{ marginTop: "0.6cqw", fontSize: "1.45cqw" }}>Team Hoo Lee Sheet · Laluan</p>
      </div>

      {/* Footer */}
      <p className="absolute inset-x-0 text-center" style={{ bottom: "5.6%", fontSize: "1.15cqw" }}>
        Platform-issued by Laluan. No third-party accreditation logos.
      </p>
    </section>
  );
}
