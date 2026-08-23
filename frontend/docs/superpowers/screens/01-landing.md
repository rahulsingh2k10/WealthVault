# Screen: Landing Page (`/`)

> Read `00-global-architecture.md` first — this doc assumes knowledge of the root layout, provider chain, and auth flow.

---

## Purpose

The landing page is the **unauthenticated entry point**. It renders a hero, a sign-in card with four OAuth providers, a feature grid, and a security callout. It has no server-side data fetching and no API calls. Its only job is to let the user initiate OAuth.

---

## File Map

| File | Role |
|------|------|
| `src/app/page.tsx` | The only file. Entire page is self-contained — layout, icons, colour tokens, and feature data. |
| `src/app/layout.tsx` | Root layout wraps this page; renders `AppBar` above it. |
| `src/components/layout/AppBar.tsx` | Top bar with ThemeTogglePill; visible on this page. |
| `src/components/layout/ThemeTogglePill.tsx` | Dark/light mode toggle rendered inside AppBar. |

No imports from `lib/`, `context/`, or `components/` beyond `AppBar`. Everything else — SVG icons, colour tokens, feature list — is defined inline in `page.tsx`.

---

## Component Hierarchy

```
Root Layout (layout.tsx)
└── ThemeProvider (next-themes)
    └── LocaleProvider
        └── CurrencyProvider
            ├── AppBar                  ← ThemeTogglePill inside
            └── LandingPage (page.tsx)  ← children
                ├── Ambient orb layer   ← aria-hidden, fixed, pointer-events-none
                ├── <section> Hero
                │   ├── <h1> Headline
                │   ├── Subheadline <div>
                │   └── Sign-in card <div>
                │       ├── GoogleIcon + <a href="/api/auth/google">
                │       ├── AppleIcon  + <a href="/api/auth/apple">
                │       ├── XIcon      + <a href="/api/auth/x">
                │       └── LinkedInIcon + <a href="/api/auth/linkedin">
                ├── <section> Feature grid
                │   └── 5× feature card (icon, title, desc)
                ├── <section> Security callout
                └── <footer>
```

---

## Architecture Notes

### Rendering model

`'use client'` — the page is a **client component** because it reads `useTheme()` from `next-themes` to compute colour tokens at runtime. There is no server-only work, no Prisma, no session check.

### Theme handling (hydration-safe pattern)

```typescript
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
const isDark = !mounted || theme === 'dark' || theme === 'system'
```

Before `mounted` is `true` (i.e., during SSR and first hydration), `isDark` defaults to `true`. This renders the dark shell immediately and avoids a visible flash when the page loads. After hydration the real `theme` value takes over.

### Colour token system

All colours are derived from `isDark` into named constants (`textPri`, `textSec`, `cardBg`, `accent`, etc.) at the top of the render function. No Tailwind colour classes are used for theme-sensitive values — all are passed via inline `style={{}}`. This makes the theme switch instant without re-rendering subtrees.

```
DARK_BG  = linear-gradient(135deg, #050A2E → #0F1E6B → #7A3D00 → #B86A00 → #D4920A)
LIGHT_BG = linear-gradient(135deg, #C8C0FF → #E0D0FF → #FFD0B0 → #FFB888)
```

### OAuth sign-in card

Each provider is a plain `<a>` tag pointing to its API route handler. There is no JavaScript involved in the sign-in flow — clicking the link triggers a full-page navigation to the GET handler, which sets up the OAuth redirect.

| Provider | Route | Visual |
|----------|-------|--------|
| Google | `/api/auth/google` | White pill, Google colours |
| Apple | `/api/auth/apple` | Black pill |
| X | `/api/auth/x` | Dark-grey pill, row with LinkedIn |
| LinkedIn | `/api/auth/linkedin` | Blue pill, row with X |

### Animated background orbs

Three `position: fixed` divs with `aria-hidden` and `pointer-events-none` create a layered depth effect. They use Tailwind custom animation classes (`animate-float-slow`, `animate-float-medium`, `animate-float-fast`) defined in `tailwind.config.ts`.

### Feature list

Defined as a module-level constant array `features[]`, each entry typed as `{ icon: LucideIcon; title: string; desc: string }`. Rendered in a `grid-cols-3` layout.

---

## Data Flow

```
User visits /
      │
      ▼
Next.js serves LandingPage (client component, no auth gate)
      │
      ├── useTheme() → reads localStorage or system preference
      │
      └── User clicks "Continue with Google"
                │
                ▼
          GET /api/auth/google
                │
                ▼
          (see global architecture — Auth & Session Flow)
```

---

## What This Page Does NOT Do

- No session check (middleware handles redirect if already logged in)
- No `useCurrency()` — no monetary values
- No `AppShell` — has its own full-page layout
- No API calls on mount
