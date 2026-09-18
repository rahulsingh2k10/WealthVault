"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocale } from "@/context/LocaleContext";
import { LOCALES, type Locale } from "@/i18n/translations";
import { COUNTRIES, countryFlag } from "@/i18n/countries";
import { savePreference } from "@/lib/savePreference";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

/**
 * One setting per row-card: label + hint on the left, control on the right.
 * Stacks (label/hint above a full-width control) below the `sm` breakpoint.
 */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-stretch gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
      style={{
        background: "var(--ui-subtle-bg)",
        border: "1px solid var(--ui-card-border)",
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: "var(--ui-text-muted)" }}>
          {hint}
        </span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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

  return (
    <div
      className="mx-auto flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl lg:max-w-[860px] xl:max-w-[1000px]"
      style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
    >
      <div className="flex flex-col gap-3 p-6 sm:p-8">
        <Row label={t.sidebar.country} hint="Sets your currency and number formatting">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(({ code, name }) => (
                <SelectItem key={code} value={code}>
                  {countryFlag(code)} {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label={t.sidebar.language} hint="Language used across the app">
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map(({ code, native }) => (
                <SelectItem key={code} value={code}>
                  {native}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Theme" hint="When you sign out, the app follows your device">
          <div
            className="inline-flex w-full overflow-hidden rounded-lg sm:w-fit"
            style={{ border: "1px solid var(--ui-input-border)" }}
          >
            {(["dark", "light"] as const).map((mode) => {
              const active = mode === "dark" ? isDark : !isDark;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => chooseTheme(mode)}
                  className="flex-1 px-4 py-2 text-sm font-medium capitalize transition-colors sm:flex-none"
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
        </Row>
      </div>
    </div>
  );
}
