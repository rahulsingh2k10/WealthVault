# Adapted `Select` Component — Design

**Date:** 2026-09-10

## Problem

We want the shadcn/Radix `Select` from the provided snippet (rounded trigger,
ring focus glow, icon slots, chevron flip, animated open/close, item hover-slide,
check-pop) as a reusable dropdown, replacing the native `<select>` on the
Settings page.

The snippet cannot be pasted verbatim:

- It targets a **Tailwind v4 + HextaUI** project. This app is **Tailwind v3.3**
  with a bespoke `--ui-*` / `--warm-*` CSS-variable token system.
- Its colour classes (`bg-background`, `border-border`, `bg-input`, `bg-accent`,
  `ring`, `text-muted-foreground`, `rounded-ele`) are **not defined** in this
  project's `tailwind.config.ts` (`theme.extend.colors` has only `gain`, `loss`,
  `brand`). They would emit nothing — the dropdown would render with no
  background, border, or focus ring. (Two other dropped-in components,
  `StocksTable` and `server-management-table`, already rely on the same
  undefined classes and are silently unstyled today.)
- Dependencies `@radix-ui/react-select`, `class-variance-authority`,
  `tailwindcss-animate` are not installed.
- `import { motion } from "motion/react"` — this app has `framer-motion@12`
  (same library, different entry point). Adding `motion` separately would
  duplicate it.
- The provided CSS block (`@import "tailwindcss"`, `tw-animate-css`, `--hu-*`
  vars, `--radius`) is Tailwind v4 syntax and **must not** be added — it would
  break this project's v3 `@tailwind base/components/utilities` setup.

## Goal

1. Add `src/components/ui/Select.tsx` — the snippet's **design and interactions**,
   recoloured with this app's existing `--ui-*` tokens so it looks native in
   light and dark.
2. Use it for the **Country** and **Language** dropdowns in `SettingsPanel.tsx`.
3. No changes to `tailwind.config.ts` colours or `globals.css` tokens. The only
   `tailwind.config.ts` change is registering the `tailwindcss-animate` plugin
   (adds new utilities only — touches nothing existing).

**Non-goals:**

- Wiring a global semantic-colour layer (`bg-background` etc.) into
  `tailwind.config.ts`. That would also restyle `StocksTable` / `DataTable` on
  the currently-broken portfolio pages — deferred.
- Touching `EditModal.tsx` — its `<select>` lives in `SelectField`, which
  **nothing imports** (verified). Pre-existing dead code; left alone.
- The theme control in `SettingsPanel` (segmented Dark/Light buttons) — stays.
- Cross-project reuse — this change is WealthVault-only. Other repos would copy
  the file separately.
- Adding `data-[state=checked]` row highlighting — the snippet only marks the
  selected row with a check icon; keep that.

---

## 1. Dependencies

```
npm install @radix-ui/react-select class-variance-authority tailwindcss-animate
```

- `@radix-ui/react-select` — Radix primitive (React 18 compatible).
- `class-variance-authority` — `cva` for the trigger/content variants.
- `tailwindcss-animate` — supplies `animate-in` / `fade-in-0` / `zoom-in-95` /
  `slide-in-from-top-2` etc. used on `SelectContent` for the open/close
  transition.

`framer-motion` and `lucide-react` are already installed.

## 2. `tailwind.config.ts`

One line only — register the plugin:

```ts
plugins: [require("tailwindcss-animate")],
```

(shadcn's own `tailwind.config.ts` uses `require(...)` here; Next's config
loader handles it in a TS file.)

## 3. `src/components/ui/Select.tsx`

The snippet, with these mechanical substitutions. Nothing else about the
structure, exports, variants, refs, or animation wrappers changes.

### Imports

| Snippet | This file |
|---|---|
| `import { motion } from "motion/react";` | `import { motion } from "framer-motion";` |

All other imports unchanged (`react`, `@radix-ui/react-select`,
`class-variance-authority`, `@/lib/utils` `cn`, `lucide-react`).

### Colour / radius class substitutions

Applied everywhere they appear in the snippet (trigger variants, content
variants, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`,
`SelectItem`, `SelectSeparator`):

| Snippet class | Replacement | Notes |
|---|---|---|
| `bg-background` | `bg-[var(--ui-input-bg)]` | on the trigger |
| `bg-input` (trailing dupe on trigger base) | *(delete — trigger already has a bg)* | snippet has `border border-border bg-input` duplicated at the end of the base string; drop the dupes |
| `border-border` (trigger) | `border-[var(--ui-input-border)]` | |
| `border-border` (content, separator area) | `border-[var(--ui-card-border)]` | |
| `text-muted-foreground` | `text-[var(--ui-text-muted)]` | |
| `text-foreground` (content base) | `text-[var(--ui-text-pri)]` | |
| `bg-background` (content base) | `bg-[var(--ui-modal-bg)]` | near-opaque panel, flips in dark |
| `hover:bg-accent hover:text-accent-foreground` (trigger `default`/`ghost`) | `hover:bg-[var(--ui-subtle-bg)]` | drop the `text-accent-foreground` |
| `hover:border-ring` (trigger `outline`) | `hover:border-[var(--ui-accent-border)]` | |
| `focus:ring-ring focus:ring-offset-2` (trigger base) | `focus:ring-[var(--ui-accent-border)]` (drop `ring-offset-2`) | app uses no ring-offset anywhere; keep `focus:ring-2 focus:outline-none` |
| `focus:bg-accent focus:text-accent-foreground` (`SelectItem`) | `focus:bg-[var(--ui-subtle-bg)] focus:text-[var(--ui-text-pri)]` | |
| `data-[disabled]:text-muted-foreground` (`SelectItem`) | `data-[disabled]:text-[var(--ui-text-muted)]` | |
| `bg-muted` (`SelectSeparator`) | `bg-[var(--ui-card-border)]` | |
| `shadow-sm/2` (trigger variants) | `shadow-sm` | `/2` is v4 opacity-shadow syntax |
| `shadow-lg` (content base) | `shadow-lg` | keep |
| `rounded-ele` (trigger) | `rounded-lg` | matches every other input/control in the app |
| `rounded-ele` (content) | `rounded-xl` | matches the app's popovers/cards |
| `scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent` (viewport) | `scrollbar-thin` | app's own utility (globals.css); the `scrollbar-thumb-*` / `-track-*` classes need a plugin that isn't installed |

Everything using `tailwindcss-animate` utilities on `SelectContent`
(`data-[state=open]:animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`,
etc.) stays **verbatim** — the plugin from §1 provides them.

The `motion.div` wrappers in `SelectContent` and `SelectItem`
(`initial`/`animate`/`exit`/`whileHover={{ x: 2 }}`/check-pop `scale`) stay
**verbatim** — that is the snippet's motion design and it is what "match the
snippet" means here.

### Exports

Unchanged from the snippet:

```ts
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectLabel, SelectItem, SelectSeparator, selectTriggerVariants,
};
```

### File header

Add a short doc comment marking it the standard:

```tsx
/**
 * Select — the app's standard dropdown. Radix Select styled with the app's
 * --ui-* tokens. Prefer this over a native <select> for new UI.
 * Adapted from a shadcn/HextaUI snippet (Tailwind v4 → v3, tokens remapped).
 */
```

## 4. `SettingsPanel.tsx`

Replace the two native `<select>` blocks. Radix Select is controlled with
`value` + `onValueChange` (a bare string), not `onChange` + `e.target.value`.

**Imports:** add
`import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";`

**Country row:**

```tsx
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
```

**Language row:**

```tsx
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
```

- `w-full sm:w-56` keeps the redesign's responsive behaviour: full-width in the
  stacked mobile row, fixed 14rem beside the label on desktop. `SelectContent`
  already matches the trigger width (`min-w-[var(--radix-select-trigger-width)]`
  in the snippet).
- `SelectValue` renders the selected item's text (e.g. "🇺🇸 United States",
  "English"); the placeholder only shows if the value is somehow empty.
- `fieldStyle` in `SettingsPanel` is now referenced by nothing (both selects
  used it) → **delete the `fieldStyle` const**. It is orphaned by this change.
- The theme segmented control is untouched.

## Data flow

Unchanged. `country` / `locale` still come from `useLocale()`; selecting an
option calls `setCountry` / `setLocale` exactly as the native `onChange` did,
which flows to `LocaleContext` and (via existing code) `savePreference`. This is
a presentation swap of the input control only.

## Rendering / layering

- `SelectContent` renders through `SelectPrimitive.Portal` (document body), so
  `AppShell`'s `overflow-hidden` does not clip it.
- Content `z-50`; sits above the sidebar (`z-40`) and mobile backdrop (`z-30`),
  level with the fixed header — fine for a menu opened from `<main>`.
- Colours resolve from `--ui-*`, which flip under `.dark` — no dark-mode-specific
  code needed.

## Error handling

None to add. No new async paths.

## Testing / verification

No component test harness exists. Manual, signed in, on `/settings`:

1. Both dropdowns: click to open (animated), pick an option, value shows in the
   trigger, menu closes. Chevron rotates while open.
2. Keyboard: focus the trigger, `Enter`/`Space` opens, arrow keys move, `Enter`
   selects, `Esc` closes. Focus ring is visible on the trigger.
3. Selection behaviour matches before: changing Country updates currency/format;
   changing Language switches app strings; both persist across reload.
4. Dark mode and light mode: trigger, panel, hovered item, selected-item check,
   scrollbar all themed, nothing hard-coded/stuck.
5. Mobile (< 640px): trigger is full-width in the stacked row; the open panel is
   not clipped and matches the trigger width; no horizontal scroll.
6. `cd frontend && npx tsc --noEmit` — no new errors in `Select.tsx` or
   `SettingsPanel.tsx`.
7. `cd frontend && npm run dev` boots and `/settings` compiles with no error in
   the log (confirms the `tailwindcss-animate` plugin registration is valid).

## Known pre-existing quirks (unchanged, not in scope)

- `bg-background` / `bg-muted` / `border-border` used unstyled by `StocksTable`,
  `DataTable`, `server-management-table`. Fixing needs the global token layer,
  which is out of scope here.
- `SelectField` in `EditModal.tsx` is unused dead code — left as-is.
- `isDark = theme !== "light"` in `SettingsPanel` shows "Dark" while
  `theme === "system"` (sub-second window on load). Carried from the
  sign-out-theme-reset work.
