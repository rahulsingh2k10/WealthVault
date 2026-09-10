# Adapted `Select` Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable Radix `Select` (the provided snippet's design + interactions, recoloured with the app's `--ui-*` tokens) and use it for the Country and Language dropdowns on `/settings`.

**Architecture:** New client component `src/components/ui/Select.tsx` wrapping `@radix-ui/react-select`, styled entirely with `bg-[var(--ui-*)]` arbitrary-value classes so it themes in light/dark with no `tailwind.config`/`globals.css` colour changes. `SettingsPanel.tsx` swaps its two native `<select>` elements for it (`onValueChange` instead of `onChange`).

**Tech Stack:** Next.js 14.1 (App Router), React 18, TypeScript 5 (`strict`), Tailwind v3.3, `framer-motion@12`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-09-10-select-component-design.md`

---

## Context for the implementer

- **Only three files change:** `package.json` (+lockfile) via `npm install`, `frontend/tailwind.config.ts` (one line), `frontend/src/components/ui/Select.tsx` (new), `frontend/src/components/settings/SettingsPanel.tsx`.
- **No `globals.css` change. No `tailwind.config.ts` colour change.** The only config edit is registering the `tailwindcss-animate` plugin, which adds new utility classes and alters nothing existing.
- **Do not** add the CSS block from the original request — it is Tailwind v4 syntax and would break this v3 project.
- **Type-check:** `cd frontend && npx tsc --noEmit`. Large pre-existing unrelated error backlog — the bar is **no new errors in `Select.tsx` or `SettingsPanel.tsx`**. `tsconfig.json` has `strict: true` but no `noUnusedLocals`/`noUnusedParameters`, so the snippet's unused destructured `placeholder` in `SelectTrigger` is fine as-is.
- **No component test harness** exists; verification is `tsc` + `npm run dev` boot + manual (Task 4).
- The app already uses `framer-motion` this way (`ConfirmDialog.tsx` imports `{ AnimatePresence, motion, useReducedMotion } from "framer-motion"`).
- `cn` lives at `@/lib/utils` (`clsx` + `tailwind-merge`).

---

## Task 1: Install dependencies and register the animate plugin

**Files:**
- Modify: `frontend/package.json` + `frontend/package-lock.json` (via npm)
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1: Install the three packages**

Run: `cd frontend && npm install @radix-ui/react-select class-variance-authority tailwindcss-animate`
Expected: installs cleanly. `@radix-ui/react-select` peer-accepts React 18; no peer-dep errors. If npm prints an unrelated peer warning from the existing tree, that is pre-existing — do not "fix" it.

- [ ] **Step 2: Register the plugin in `tailwind.config.ts`**

The file currently ends:

```ts
  },
  plugins: [],
};

export default config;
```

Change the `plugins` line:

```ts
  plugins: [require("tailwindcss-animate")],
```

Leave everything else untouched. (shadcn's own `tailwind.config.ts` uses `require(...)` here; Next's Tailwind config loader handles it in a `.ts` file.)

- [ ] **Step 3: Verify the config still loads**

Run: `cd frontend && npx tailwindcss -i ./src/app/globals.css -o /dev/null 2>&1 | tail -5`
Expected: no error (a "Done in ..." line, or clean exit). If it complains about `require`, fall back to an import: add `import tailwindcssAnimate from "tailwindcss-animate";` at the top and use `plugins: [tailwindcssAnimate]`.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tailwind.config.ts
git commit -m "Add @radix-ui/react-select, cva, tailwindcss-animate for the Select component

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 2: Add `src/components/ui/Select.tsx`

**Files:**
- Create: `frontend/src/components/ui/Select.tsx`

- [ ] **Step 1: Create the file**

Write `frontend/src/components/ui/Select.tsx` with exactly this content (the provided snippet, with `motion/react`→`framer-motion` and all colour/radius classes remapped to `--ui-*` tokens):

```tsx
/**
 * Select — the app's standard dropdown. Radix Select styled with the app's
 * --ui-* tokens. Prefer this over a native <select> for new UI.
 * Adapted from a shadcn/HextaUI snippet (Tailwind v4 -> v3, tokens remapped).
 */
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type LucideIcon, ChevronDown, Check } from "lucide-react";
import { motion } from "framer-motion";

const selectTriggerVariants = cva(
  "flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] px-3 py-2 text-sm text-[var(--ui-text-pri)] transition-all placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent-border)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  {
    variants: {
      variant: {
        default: "hover:bg-[var(--ui-subtle-bg)] shadow-sm",
        outline: "border-2 hover:border-[var(--ui-accent-border)] shadow-sm",
        ghost: "border-transparent hover:bg-[var(--ui-subtle-bg)]",
      },
      size: {
        sm: "h-8 p-2 text-xs gap-2",
        default: "h-9 p-3 gap-3",
        lg: "h-10 p-4 text-base gap-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const selectContentVariants = cva(
  "relative z-50 max-h-[300px] min-w-[8rem] overflow-hidden rounded-xl border border-[var(--ui-card-border)] bg-[var(--ui-modal-bg)] text-[var(--ui-text-pri)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      position: {
        popper:
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        "item-aligned": "",
      },
    },
    defaultVariants: {
      position: "popper",
    },
  }
);

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value> & {
    placeholder?: string;
  }
>(({ className, placeholder, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn("text-sm select-none", className)}
    placeholder={
      placeholder && (
        <span className="text-[var(--ui-text-muted)] select-none">
          {placeholder}
        </span>
      )
    }
    {...props}
  />
));
SelectValue.displayName = SelectPrimitive.Value.displayName;

interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {
  icon?: LucideIcon;
  placeholder?: string;
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(
  (
    { className, children, variant, size, icon: Icon, placeholder, ...props },
    ref
  ) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "group",
        selectTriggerVariants({ variant, size }),
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {Icon && (
          <Icon size={16} className="shrink-0 text-[var(--ui-text-muted)]" />
        )}
        <span className="truncate">{children}</span>
      </div>{" "}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          size={16}
          className="opacity-50 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  position?: "popper" | "item-aligned";
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(selectContentVariants({ position }), className)}
      position={position}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "p-2 max-h-[280px] overflow-y-auto scrollbar-thin",
            position === "popper" &&
              "h-fit w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </motion.div>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-3 py-2 text-xs font-semibold text-[var(--ui-text-muted)]",
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  icon?: LucideIcon;
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, icon: Icon, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-3 pr-8 text-sm outline-none focus:bg-[var(--ui-subtle-bg)] focus:text-[var(--ui-text-pri)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled]:text-[var(--ui-text-muted)]",
      className
    )}
    {...props}
  >
    <motion.div
      className="flex w-full items-center gap-2"
      whileHover={{ x: 2 }}
      transition={{ duration: 0.1 }}
    >
      {Icon && <Icon size={16} className="shrink-0" />}
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </motion.div>
    <span className="absolute right-3 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.1 }}
        >
          <Check size={16} />
        </motion.div>
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[var(--ui-card-border)]", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  selectTriggerVariants,
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'src/components/ui/Select\.tsx' || echo "no new errors in Select.tsx"`
Expected: `no new errors in Select.tsx`

If a type error surfaces on the `SelectValue` `placeholder` prop (`string` vs `ReactNode`), widen the added type from `placeholder?: string` to `placeholder?: React.ReactNode` — the only allowed deviation from the snippet.

- [ ] **Step 3: Confirm the dev server compiles the module**

Run: `cd frontend && npm run dev` (background it), wait for "Ready", then in another shell:
`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` and check the dev log has no `Module not found` / compile error mentioning `Select.tsx` or `@radix-ui/react-select`. Stop the server when done, or leave it for Task 3.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/Select.tsx
git commit -m "Add Select — Radix dropdown styled with the app's --ui tokens

Adapted from the provided shadcn/HextaUI snippet: motion/react -> framer-motion,
all bg-background/border-border/rounded-ele classes remapped to bg-[var(--ui-*)].
Behaviour, cva variants and motion animations are unchanged. Standard dropdown
for new UI going forward.

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 3: Use `Select` for the Settings Country + Language dropdowns

**Files:**
- Modify: `frontend/src/components/settings/SettingsPanel.tsx`

### Current file (full — for reference)

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

- [ ] **Step 1: Add the import**

After the `savePreference` import line, add:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
```

- [ ] **Step 2: Delete the `fieldStyle` const**

Both `<select>` elements were its only users. Remove:

```tsx
  const fieldStyle = {
    background: "var(--ui-input-bg)",
    border: "1px solid var(--ui-input-border)",
    color: "var(--ui-text-pri)",
  };
```

- [ ] **Step 3: Replace the Country `<select>`**

Replace the whole `<select value={country}...>...</select>` block inside the Country `<Row>` with:

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

- [ ] **Step 4: Replace the Language `<select>`**

Replace the whole `<select value={locale}...>...</select>` block inside the Language `<Row>` with:

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

Leave the Theme `<Row>` and everything else unchanged.

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'src/components/settings/SettingsPanel\.tsx' || echo "no new errors in SettingsPanel.tsx"`
Expected: `no new errors in SettingsPanel.tsx`

- [ ] **Step 6: Confirm `/settings` compiles**

With `npm run dev` running, the settings route reaches middleware and redirects unauthenticated, so it will not compile from a bare `curl`. Instead confirm no build error by checking `npx tsc --noEmit` (Step 5) is clean and the dev log shows no error after a save. The real check is Task 4 (manual, signed in).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/settings/SettingsPanel.tsx
git commit -m "Use the Select component for the settings Country and Language dropdowns

Native <select> -> <Select> (onValueChange); drop the now-unused fieldStyle.
Theme control unchanged.

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 4: Manual verification

No code changes. `cd frontend && npm run dev`, sign in, open `/settings`.

- [ ] **Step 1: Open / select / close**

Click the Country trigger — panel animates open (fade + slight zoom/slide), chevron rotates 180°. Pick a country — the name shows in the trigger, panel closes, chevron rotates back. Repeat for Language.

- [ ] **Step 2: Keyboard + focus**

Tab to the trigger — a focus ring (`--ui-accent-border`) is visible. `Enter`/`Space` opens, `↑`/`↓` move the highlight, typing a letter jumps to a match, `Enter` selects, `Esc` closes and returns focus to the trigger.

- [ ] **Step 3: Behaviour unchanged**

Changing Country updates currency/number formatting elsewhere as before; changing Language switches app strings. Reload `/settings` — both keep their values.

- [ ] **Step 4: Light + dark**

Toggle the Theme control. In both themes: trigger bg/border/text, the open panel, the hovered item (`--ui-subtle-bg`), the selected item's check, and the scrollbar are all themed — nothing stuck light or invisible.

- [ ] **Step 5: Mobile (< 640px)**

Narrow the window. Each row stacks; the trigger is full-width. Opening the panel: it is not clipped by the settings card (`overflow-hidden`) because it is portalled to `<body>`; its width matches the trigger. No horizontal scrollbar. The long Country list scrolls inside the panel (max-height ~280px).

- [ ] **Step 6: Report**

Note anything off. A broken/clipped/unreadable panel blocks; minor cosmetic nits get listed, not blocked.

---

## Self-review notes

- **Spec coverage:** deps + plugin → Task 1; adapted component with the full substitution table applied → Task 2 Step 1 (every `bg-background`/`border-border`/`text-muted-foreground`/`rounded-ele`/`bg-muted`/`shadow-sm/2`/`scrollbar-thumb-*` from the snippet is remapped in the file above); Country + Language swap + `fieldStyle` removal → Task 3; no `globals.css`/colour-config changes (only the plugin line); `EditModal`/theme control untouched.
- **`motion/react` → `framer-motion`:** done in the file (import line).
- **Type consistency:** `Select`, `SelectTrigger`, `SelectContent`, `SelectValue`, `SelectItem` are the names exported by `Select.tsx` and the exact names imported in `SettingsPanel.tsx` Step 1. `onValueChange` receives a `string`; `setCountry` takes a `string`; `setLocale` is fed `v as Locale`.
- **No placeholders:** the complete `Select.tsx` and every before/after edit block are inline.
- **One allowed deviation, pre-authorised in Task 2 Step 2:** widen `SelectValue`'s `placeholder?: string` to `React.ReactNode` only if `tsc` demands it.
