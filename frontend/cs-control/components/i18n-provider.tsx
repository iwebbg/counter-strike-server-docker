"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMessages, type MessageKey } from "@/i18n/messages";
import type { Locale } from "@/lib/types";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("bg");
  useEffect(() => {
    const saved = localStorage.getItem("cs16-panel-language");
    setLocaleState(saved === "en" ? "en" : "bg");
  }, []);
  const setLocale = (next: Locale) => {
    localStorage.setItem("cs16-panel-language", next);
    setLocaleState(next);
    document.documentElement.lang = next;
  };
  const value = useMemo(() => {
    const dictionary = getMessages(locale);
    return {
      locale,
      setLocale,
      t: (key: MessageKey, values: Record<string, string | number> = {}) => {
        let message: string = dictionary[key];
        for (const [name, replacement] of Object.entries(values)) {
          message = message.replaceAll(`{${name}}`, String(replacement));
        }
        return message;
      },
    };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("I18nProvider is missing");
  return context;
}
