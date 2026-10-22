// Site language (EN | BM). A small dictionary + context; the choice is kept
// in localStorage and mirrored to <html lang>. Strings without a BM entry
// fall back to English. Course language is a separate setting (interview Q5).
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SiteLocale = "en" | "ms";
export const SITE_LOCALES: ReadonlyArray<{ id: SiteLocale; label: string }> = [
  { id: "en", label: "EN" },
  { id: "ms", label: "BM" },
];

const STORAGE_KEY = "laluan.siteLocale";

const EN = {
  "lang.label": "Site language",
  "nav.profile": "Profile",
  "nav.interview": "Interview",
  "nav.results": "Results",
  "nav.pathway": "Pathway",
  "footer.tagline": "Your route through AI at work.",
  "footer.about": "About",
  "footer.sources": "Data sources",
  "footer.privacy": "Privacy",
  "footer.disclaimer":
    "All scores and forecasts are estimates. Laluan supports your decision; it does not make hiring decisions.",
  "landing.eyebrow": "Free, 3 minutes, no login",
  "landing.title": "Your route through AI at work.",
  "landing.lede":
    "Laluan reads a CV, scores how much AI touches your tasks, and draws a free week-by-week path to a role that fits.",
  "landing.start": "Start",
  "landing.consent": "I understand Laluan uses synthetic CVs, gives estimates, and does not make hiring decisions.",
  "landing.stopsTitle": "Four stops. About three minutes.",
  "landing.stop1.body": "Upload your CV. Check the skills we read.",
  "landing.stop2.body": "Five quick questions, tap to answer.",
  "landing.stop3.body": "AI exposure today, three roles under three futures.",
  "landing.stop4.body": "Your week-by-week route, free courses first.",
  "landing.promise1": "Synthetic CVs only",
  "landing.promise2": "Nothing stored, no login",
  "landing.promise3": "Public data, every score dated",
  "results.heading": "Your future pathway",
  "results.headingNamed": "{name}'s future pathway",
  "interview.title": "Five quick questions",
} as const;

export type MessageKey = keyof typeof EN;

// Bahasa Melayu. Reviewed by hand; no machine translation of the rest of the UI.
const MS: Partial<Record<MessageKey, string>> = {
  "lang.label": "Bahasa laman",
  "nav.profile": "Profil",
  "nav.interview": "Temu bual",
  "nav.results": "Keputusan",
  "nav.pathway": "Laluan",
  "footer.tagline": "Laluan anda melalui AI di tempat kerja.",
  "footer.about": "Tentang",
  "footer.sources": "Sumber data",
  "footer.privacy": "Privasi",
  "footer.disclaimer":
    "Semua skor dan ramalan adalah anggaran. Laluan menyokong keputusan anda; ia tidak membuat keputusan pengambilan pekerja.",
  "landing.eyebrow": "Percuma, 3 minit, tanpa log masuk",
  "landing.title": "Laluan anda melalui AI di tempat kerja.",
  "landing.lede":
    "Laluan membaca CV, menilai sejauh mana AI menyentuh tugas anda, dan melakar laluan mingguan percuma ke peranan yang sesuai.",
  "landing.start": "Mula",
  "landing.consent":
    "Saya faham Laluan menggunakan CV sintetik, memberi anggaran, dan tidak membuat keputusan pengambilan pekerja.",
  "landing.stopsTitle": "Empat hentian. Kira-kira tiga minit.",
  "landing.stop1.body": "Muat naik CV anda. Semak kemahiran yang kami baca.",
  "landing.stop2.body": "Lima soalan ringkas, ketik untuk menjawab.",
  "landing.stop3.body": "Pendedahan AI hari ini, tiga peranan dalam tiga senario masa depan.",
  "landing.stop4.body": "Laluan mingguan anda, kursus percuma dahulu.",
  "landing.promise1": "CV sintetik sahaja",
  "landing.promise2": "Tiada data disimpan, tanpa log masuk",
  "landing.promise3": "Data awam, setiap skor bertarikh",
  "results.heading": "Laluan masa depan anda",
  "results.headingNamed": "Laluan masa depan {name}",
  "interview.title": "Lima soalan ringkas",
};

export function translate(locale: SiteLocale, key: MessageKey, vars?: Record<string, string>): string {
  let text: string = (locale === "ms" ? MS[key] : undefined) ?? EN[key];
  for (const [name, value] of Object.entries(vars ?? {})) text = text.replaceAll(`{${name}}`, value);
  return text;
}

type LocaleContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
  t: (key: MessageKey, vars?: Record<string, string>) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => translate("en", key, vars),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted choice after hydration
    if (stored === "en" || stored === "ms") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: SiteLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return useContext(LocaleContext);
}
