# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/settings` so its container matches the Subscription "Manage" panel and each setting is a label-left / control-right row-card that stacks on mobile — without changing any settings behavior.

**Architecture:** Presentation-only rewrite of the JSX returned by `SettingsPanel.tsx`. All hooks, state, option lists, `onChange` handlers and `savePreference` calls are kept verbatim. A small local `Row` presentational helper is added to the same file.

**Tech Stack:** Next.js 14 (App Router), React client component, Tailwind CSS, CSS custom-property design tokens (`--ui-*`).

**Spec:** `docs/superpowers/specs/2026-09-09-settings-page-redesign-design.md`

---

## Context for the implementer

- **The only file that changes is** `frontend/src/components/settings/SettingsPanel.tsx`. Do not touch `src/app/settings/page.tsx`, `AppShell`, `Header`, or any context/provider.
- **Dev server:** `cd frontend && npm run dev` → http://localhost:3000/settings (requires being signed in). It may not be running — start it if you need to look, but visual verification is primarily the human's (Task 2).
- **No automated UI/DOM test harness exists** in this repo for React components. Do not add one. Verification is `tsc` + manual.
- **Type-check:** `cd frontend && npx tsc --noEmit`. There is a large pre-existing backlog of unrelated TS errors — the bar is **no new errors in `SettingsPanel.tsx`**.
- **Design language being matched** comes from `frontend/src/components/subscription/PaidTierPlanPicker.tsx`: wrapper classes `mx-auto flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl lg:max-w-[860px] xl:max-w-[1000px]` with inline `style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}`.
- The page renders no title of its own — `AppShell`'s header bar already shows "Settings".

---

## Task 1: Rewrite `SettingsPanel.tsx`

**Files:**
- Modify: `frontend/src/components/settings/SettingsPanel.tsx`

### Current file (for reference — this is the full file today)

```tsx
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
```

- [ ] **Step 1: Replace the entire file with the new version**

Write `frontend/src/components/settings/SettingsPanel.tsx` with exactly this content:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocale } from "@/context/LocaleContext";
import { LOCALES, type Locale } from "@/i18n/translations";
import { COUNTRIES, countryFlag } from "@/i18n/countries";
import { savePreference } from "@/lib/savePreference";

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

  const fieldStyle = {
    background: "var(--ui-input-bg)",
    border: "1px solid var(--ui-input-border)",
    color: "var(--ui-text-pri)",
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl lg:max-w-[860px] xl:max-w-[1000px]"
      style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
    >
      <div className="flex flex-col gap-3 p-6 sm:p-8">
        <Row label={t.sidebar.country} hint="Sets your currency and number formatting">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm sm:w-auto"
            style={fieldStyle}
          >
            {COUNTRIES.map(({ code, name }) => (
              <option key={code} value={code}>
                {countryFlag(code)} {name}
              </option>
            ))}
          </select>
        </Row>

        <Row label={t.sidebar.language} hint="Language used across the app">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="w-full rounded-lg px-3 py-2 text-sm sm:w-auto"
            style={fieldStyle}
          >
            {LOCALES.map(({ code, native }) => (
              <option key={code} value={code}>
                {native}
              </option>
            ))}
          </select>
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
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'src/components/settings/SettingsPanel\.tsx' || echo "no new errors in SettingsPanel.tsx"`
Expected: `no new errors in SettingsPanel.tsx`

- [ ] **Step 3: Lint the file**

Run: `cd frontend && npx next lint --file src/components/settings/SettingsPanel.tsx 2>&1 | tail -20`
Expected: no errors (the repo has no committed ESLint config, so this may print a setup prompt or "No ESLint warnings or errors" — either is acceptable; do NOT add an ESLint config).

- [ ] **Step 4: Sanity-check the diff**

Run: `git -C .. diff --stat -- frontend/src/components/settings/SettingsPanel.tsx` (from `frontend/`) or `git diff --stat -- frontend/src/components/settings/SettingsPanel.tsx` (from repo root).
Expected: exactly one file changed. Eyeball `git diff` and confirm: the `useLocale`/`useTheme`/`mounted`/`isDark`/`chooseTheme`/`fieldStyle` lines are byte-for-byte unchanged; the `COUNTRIES.map` / `LOCALES.map` bodies and the two `onChange` handlers are unchanged; only the wrapper markup and the new `Row` helper differ.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/settings/SettingsPanel.tsx
git commit -m "Redesign settings page to match the subscription panel

Elevated --ui-modal panel at the subscription width; each setting is a
label-left / control-right row-card that stacks on mobile. Behavior,
state and savePreference calls are unchanged.

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 2: Manual verification

No code changes. Run the dev server, sign in, open `/settings`.

- [ ] **Step 1: Desktop**

Wide browser window. Expected: centered panel, widening to ~1000px on an xl viewport, with the elevated `--ui-modal-bg` background + soft `--ui-modal-shadow` — visually of a piece with `/subscription`. Each of the 3 rows: label + grey hint on the left, control on the right, vertically centered.

- [ ] **Step 2: Mobile**

Narrow the window to < 640px (or use DevTools device mode). Expected: each row-card stacks — label + hint on top, control below at full width. The Dark/Light buttons split the row into two equal halves. No horizontal scrollbar anywhere on the page.

- [ ] **Step 3: Behavior unchanged**

- Change **Country** → currency / number formatting elsewhere in the app updates as before.
- Change **Language** → UI strings switch language.
- Toggle **Theme** to Light, then reload → still Light (persisted). Toggle back to Dark.

- [ ] **Step 4: Dark / light both render**

Toggle theme Light ↔ Dark on the page. The panel, row-cards, hints, selects and segmented control all recolor through the tokens with no stuck/hardcoded colors.

- [ ] **Step 5: Report**

Note anything off. Cosmetic nits → list them, don't block. A broken layout or unreadable text → report before closing the feature.

---

## Self-review notes

- **Spec coverage:** container match → outer `<div>` classes + `--ui-modal-*` (Task 1 Step 1); row-card label-left/control-right → `Row` helper `sm:flex-row sm:justify-between`; mobile stack → `Row` default `flex-col items-stretch` + `w-full sm:w-auto` / `flex-1 sm:flex-none` on the controls; no behavior change → Step 4 diff check enforces it; no in-panel title → new JSX has none.
- **Type consistency:** `Row` is declared once with `{ label: string; hint: string; children: React.ReactNode }` and every call site passes exactly `label` + `hint` + children.
- **No placeholders:** the complete new file is in Step 1; no "adjust styling as needed" language.
- **Scope:** one file, one behavioral commit + one verification task.
