"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocale } from "@/context/LocaleContext";
import { LOCALES, type Locale } from "@/i18n/translations";
import { COUNTRIES, countryFlag } from "@/i18n/countries";
import { savePreference } from "@/lib/savePreference";

export function SettingsPanel() {
  const { t, locale, setLocale, country, setCountry } = useLocale();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = !mounted || theme !== "light";

  const chooseTheme = (next: "dark" | "light") => {
    setTheme(next);
    savePreference("theme", next);
  };

  const fieldStyle = {
    background: "var(--ui-input-bg)",
    border: "1px solid var(--ui-input-border)",
    color: "var(--ui-text-pri)",
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[560px] flex-col gap-6 rounded-2xl p-6"
      style={{
        background: "var(--ui-card-bg)",
        border: "1px solid var(--ui-card-border)",
        boxShadow: "var(--ui-card-shadow)",
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          {t.sidebar.country}
        </span>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={fieldStyle}
        >
          {COUNTRIES.map(({ code, name }) => (
            <option key={code} value={code}>
              {countryFlag(code)} {name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          {t.sidebar.language}
        </span>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="rounded-lg px-3 py-2 text-sm"
          style={fieldStyle}
        >
          {LOCALES.map(({ code, native }) => (
            <option key={code} value={code}>
              {native}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          Theme
        </span>
        <div
          className="inline-flex w-fit overflow-hidden rounded-lg"
          style={{ border: "1px solid var(--ui-input-border)" }}
        >
          {(["dark", "light"] as const).map((mode) => {
            const active = mode === "dark" ? isDark : !isDark;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => chooseTheme(mode)}
                className="px-4 py-2 text-sm font-medium capitalize transition-colors"
                style={{
                  background: active ? "var(--ui-accent)" : "var(--ui-input-bg)",
                  color: active ? "var(--ui-on-accent)" : "var(--ui-text-sec)",
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
