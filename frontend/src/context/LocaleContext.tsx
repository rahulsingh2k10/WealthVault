"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import translations, { Locale, Translations } from "@/i18n/translations";
import { savePreference } from "@/lib/savePreference";

const LOCALE_COOKIE  = "preferred-locale";
const COUNTRY_COOKIE = "preferred-country";
const DEFAULT_LOCALE: Locale = "en-US";
const DEFAULT_COUNTRY = "US";

interface LocaleContextValue {
  locale:    Locale;
  t:         Translations;
  setLocale: (locale: Locale) => void;
  country:    string;
  setCountry: (code: string) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale:     DEFAULT_LOCALE,
  t:          translations[DEFAULT_LOCALE],
  setLocale:  () => {},
  country:    DEFAULT_COUNTRY,
  setCountry: () => {},
});

function readCookie(key: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : fallback;
}

function writeCookie(key: string, value: string) {
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale,  setLocaleState]  = useState<Locale>(DEFAULT_LOCALE);
  const [country, setCountryState] = useState<string>(DEFAULT_COUNTRY);

  useEffect(() => {
    // Restore saved locale
    const savedLocale = readCookie(LOCALE_COOKIE, "");
    if (savedLocale && savedLocale in translations) {
      setLocaleState(savedLocale as Locale);
    }

    // Restore saved country, or auto-detect via IP
    const savedCountry = readCookie(COUNTRY_COOKIE, "");
    if (savedCountry) {
      setCountryState(savedCountry);
    } else {
      fetch("https://ipapi.co/json/", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          const code: string = data?.country_code ?? DEFAULT_COUNTRY;
          setCountryState(code);
          writeCookie(COUNTRY_COOKIE, code);
        })
        .catch(() => {}); // silently fall back to default
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeCookie(LOCALE_COOKIE, next);
    document.documentElement.lang = next.split("-")[0];
    savePreference('locale', next);
  }, []);

  const setCountry = useCallback((code: string) => {
    setCountryState(code);
    writeCookie(COUNTRY_COOKIE, code);
    savePreference('country', code);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale], setLocale, country, setCountry }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
