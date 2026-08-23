"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "@/context/LocaleContext";

interface CurrencyContextValue {
  format: (amount: number, compact?: boolean) => string;
  symbol: string;
}

const COUNTRY_CURRENCY: Record<string, { code: string; locale: string }> = {
  IN: { code: "INR", locale: "en-IN" },
  US: { code: "USD", locale: "en-US" },
  GB: { code: "GBP", locale: "en-GB" },
  DE: { code: "EUR", locale: "de-DE" },
  FR: { code: "EUR", locale: "fr-FR" },
  IT: { code: "EUR", locale: "it-IT" },
  ES: { code: "EUR", locale: "es-ES" },
  AU: { code: "AUD", locale: "en-AU" },
  CA: { code: "CAD", locale: "en-CA" },
  JP: { code: "JPY", locale: "ja-JP" },
  SG: { code: "SGD", locale: "en-SG" },
  AE: { code: "AED", locale: "ar-AE" },
  CH: { code: "CHF", locale: "de-CH" },
  NZ: { code: "NZD", locale: "en-NZ" },
  HK: { code: "HKD", locale: "zh-HK" },
};

const DEFAULT_CURRENCY = { code: "INR", locale: "en-IN" };

const CurrencyContext = createContext<CurrencyContextValue>({
  format: (v) => `₹${v.toFixed(2)}`,
  symbol: "₹",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { country } = useLocale();
  const { code, locale } = COUNTRY_CURRENCY[country] ?? DEFAULT_CURRENCY;

  const symbol =
    new Intl.NumberFormat(locale, { style: "currency", currency: code })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? code;

  const format = (amount: number, compact = false): string => {
    if (compact) {
      const abs = Math.abs(amount);
      if (code === "INR") {
        // Descending order — largest unit first so the shortest string is always chosen
        if (abs >= 1_000_000_000_000_000) return `${symbol}${(amount / 1_000_000_000_000_000).toFixed(2)}QCr`; // quad-crore
        if (abs >= 10_000_000_000_000)    return `${symbol}${(amount / 10_000_000_000_000).toFixed(2)}LCr`;    // lakh crore
        if (abs >= 10_000_000_000)        return `${symbol}${(amount / 10_000_000_000).toFixed(2)}KCr`;        // thousand crore
        if (abs >= 10_000_000)            return `${symbol}${(amount / 10_000_000).toFixed(2)}Cr`;
        if (abs >= 100_000)               return `${symbol}${(amount / 100_000).toFixed(2)}L`;
        if (abs >= 1_000)                 return `${symbol}${(amount / 1_000).toFixed(2)}K`;
      } else {
        if (abs >= 1_000_000_000_000) return `${symbol}${(amount / 1_000_000_000_000).toFixed(2)}T`;
        if (abs >= 1_000_000_000)     return `${symbol}${(amount / 1_000_000_000).toFixed(2)}B`;
        if (abs >= 1_000_000)         return `${symbol}${(amount / 1_000_000).toFixed(2)}M`;
        if (abs >= 1_000)             return `${symbol}${(amount / 1_000).toFixed(2)}K`;
      }
    }
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <CurrencyContext.Provider value={{ format, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
