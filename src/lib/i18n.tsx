// Site language (EN | BM). A small dictionary + context; the choice is kept
// in localStorage and mirrored to <html lang>. Strings without a BM entry
// fall back to English. Course language is a separate setting (interview Q5).
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EN, MS, SITE_LOCALES, translate, type MessageKey, type SiteLocale } from "./i18n-messages";

export { EN, MS, SITE_LOCALES, translate };
export type { MessageKey, SiteLocale };

const STORAGE_KEY = "laluan.siteLocale";

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
