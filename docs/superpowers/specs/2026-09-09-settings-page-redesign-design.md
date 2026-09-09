# Settings Page Redesign — Design

**Date:** 2026-09-09

## Problem

The `/settings` page (`SettingsPanel.tsx`) uses a small translucent card
(`max-w-[560px]`, `rounded-2xl`, `--ui-card-bg`) with each control laid out as a
label stacked **above** its input. It does not match the visual language of the
Subscription "Manage" screen (`ManageSubscription` → `PaidTierPlanPicker`), which
the team wants to standardize on: a wide, elevated panel
(`--ui-modal-bg` + `--ui-modal-shadow`, `rounded-3xl`).

The team also wants each setting presented as a **row**: label (with a short
hint) on the left, the control on the right — instead of label-above-control.

## Goal

Restyle the settings page so that:

1. The outer container matches the Subscription "Manage" screen's elevated panel
   (background, shadow, radius, responsive max-width).
2. Each setting is its own row-card: label + one-line hint on the left, control
   on the right on desktop/tablet; stacked (label/hint above a full-width
   control) below 640px.
3. It is fully responsive — usable down to small mobile widths.

**Non-goals:** changing any settings *behavior* — the `useLocale` / `useTheme`
state, the option lists, and every `savePreference(...)` call stay exactly as
they are. No new settings, no new preference keys, no API changes, no changes to
`SettingsPage` (`src/app/settings/page.tsx`) or `AppShell`. The theme control
keeps its current two-button Dark/Light design (no "System" button — that value
is only ever set programmatically on sign-out).

---

## Reference: what "match the Subscription page" means

From `src/components/subscription/PaidTierPlanPicker.tsx` — the outer wrapper the
Subscription "Manage" screen renders for a paid user:

```tsx
<div
  className="mx-auto flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl lg:max-w-[860px] xl:max-w-[1000px]"
  style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
>
```

The settings panel adopts the same wrapper classes and the same two inline style
tokens. Like `ManageSubscription`, it renders **no title of its own** — the
`AppShell` header bar (`src/components/layout/Header.tsx`) already shows
`"Settings"` (passed from `SettingsPage` via `<AppShell title="Settings">`).

---

## Component: `SettingsPanel.tsx` (rewrite the returned JSX only)

The file stays a single client component. Only the JSX tree and class/style
attributes change. Keep, unchanged:

- `"use client"` and all imports.
- `const { t, locale, setLocale, country, setCountry } = useLocale();`
- `const { theme, setTheme } = useTheme();`
- `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`
- `const isDark = !mounted || theme !== "light";`
- `const chooseTheme = (next: "dark" | "light") => { setTheme(next); savePreference("theme", next); };`
- The `COUNTRIES` / `LOCALES` `.map(...)` option rendering and the
  `onChange` handlers (`setCountry(e.target.value)`,
  `setLocale(e.target.value as Locale)`).

### Structure

```
<div  outer panel: subscription wrapper classes + --ui-modal-bg / --ui-modal-shadow >
  <div  inner padding + vertical stack of rows (gap) >
    <Row label={t.sidebar.country}  hint="Sets your currency and number formatting">
      <select country>  … </select>
    </Row>
    <Row label={t.sidebar.language} hint="Language used across the app">
      <select language> … </select>
    </Row>
    <Row label="Theme" hint="When you sign out, the app follows your device">
      <segmented Dark / Light>
    </Row>
  </div>
</div>
```

### `Row` — a small local presentational helper (defined in the same file)

```tsx
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
```

- Desktop/tablet (`sm:` ≥ 640px): `flex-row`, `items-center`, `justify-between` —
  label block left, control right.
- Mobile (< 640px): `flex-col`, `items-stretch` — label block on top, control
  container below spanning full width.

### Outer panel + stack

```tsx
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
```

The three hint strings and the `"Theme"` label are plain English literals, not
`t.*` lookups. This matches the file as it stands today (`"Theme"` is already a
literal while country/language use `t.sidebar.*`); full i18n of this page is a
separate concern and out of scope here.

`fieldStyle` is unchanged from the current file:

```tsx
const fieldStyle = {
  background: "var(--ui-input-bg)",
  border: "1px solid var(--ui-input-border)",
  color: "var(--ui-text-pri)",
};
```

### Responsive control widths

- `<select>`: `w-full sm:w-auto` — full-width in the stacked mobile row, natural
  width beside the label on desktop.
- Theme segmented control wrapper: `w-full sm:w-fit`; each button `flex-1
  sm:flex-none` — the two buttons split the row evenly on mobile, hug their text
  on desktop.

---

## Data flow

Unchanged. `useLocale()` / `useTheme()` hold the values; `onChange` /
`chooseTheme` push to context and (for theme) `savePreference`. `PreferencesSync`
and `LocaleContext` continue to hydrate and persist exactly as today. This change
is presentation-only.

## Error handling

None to add — no new code paths. `savePreference` keeps its existing
`.catch(() => {})`.

## Testing / verification

Manual, in the running app (`cd frontend && npm run dev`), signed in, on
`/settings`:

1. **Desktop (wide window):** panel is centered, wide (up to ~1000px on xl),
   with the elevated `--ui-modal` background + shadow — visually consistent with
   `/subscription`. Each of the 3 rows shows label + hint on the left, control on
   the right.
2. **Resize to < 640px** (or DevTools mobile): each row stacks — label + hint on
   top, control full-width below. The Dark/Light buttons split the row in half.
   No horizontal scrolling.
3. **Behavior unchanged:** change Country → currency/formatting updates as
   before; change Language → app strings switch; toggle Theme → theme flips and
   (after reload / re-login) persists.
4. **Dark mode:** toggle to Light then Dark; the panel and rows recolor via the
   shared tokens with no hardcoded colors left over.
5. `cd frontend && npx tsc --noEmit` — no new errors in
   `src/components/settings/SettingsPanel.tsx`.

## Known pre-existing quirks (unchanged, not in scope)

- `isDark = !mounted || theme !== "light"` shows "Dark" active while
  `theme === "system"`. Only observable in the sub-second window before
  `PreferencesSync` resolves on an authenticated load. Carried over from the
  sign-out-theme-reset work; left as-is.
