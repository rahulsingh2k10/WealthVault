# Subscription Tiers Schema Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `User.plan` field (`Plan` enum: `FREE`/`PRO`/`MAX`) with a `User.subscription` field (`Subscription` enum: `FREE`/`MONTHLY`/`QUARTERLY`/`ANNUAL`), add `subscriptionStartedAt`/`subscriptionExpiresAt` date fields, and rename every code reference from `plan` to `subscription`.

**Architecture:** Pure rename + additive schema change, no new business logic. Edit both Prisma schemas (frontend is the source of truth, backend mirrors it), push the schema to the live Railway Postgres DB, then propagate the rename through the repository, API routes, and UI that reference the field.

**Tech Stack:** Next.js (App Router), Prisma 5, PostgreSQL (Railway), Jest.

Spec: `frontend/docs/superpowers/specs/2026-08-26-subscription-tiers-design.md`

---

### Task 1: Update Prisma schema and push to the database

**Files:**
- Modify: `frontend/prisma/schema.prisma:192-217`
- Modify: `backend/prisma/schema.prisma` (same body, mirrored, keep its existing header comment)

- [ ] **Step 1: Edit `frontend/prisma/schema.prisma`**

Replace lines 192–217 (the `enum Plan` block and the `User` model) with:

```prisma
enum Subscription {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL
}

model User {
  id                     String       @id @default(cuid())
  fullName               String
  // Unique identity key across all providers:
  //   Google / LinkedIn / Apple → actual email      (e.g. rahul@gmail.com)
  //   X                         → handle only       (e.g. rahulsingh2k10)
  //   No clash possible: emails always contain @, X handles never do.
  username               String       @unique
  platform               String       // "Google" | "X" | "LinkedIn" | "Apple"
  avatar                 String?      // OAuth-provided URL or user-uploaded base64 data URL
  subscription           Subscription @default(FREE)
  subscriptionStartedAt  DateTime?
  subscriptionExpiresAt  DateTime?
  // AES-256-GCM encrypted verifier — encrypt("PORTFOLIO_APP_V1", derivedKey)
  // null  → first-time setup; non-null → passphrase already established
  // The passphrase itself is NEVER stored anywhere.
  verifier               String?
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  @@map("users")
}
```

- [ ] **Step 2: Apply the identical change to `backend/prisma/schema.prisma`**

That file has the same content as `frontend/prisma/schema.prisma` plus a header comment
warning the two must stay in sync. Leaving that header comment at the top of the file
untouched, replace its `enum Plan` block and `User` model with:

```prisma
enum Subscription {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL
}

model User {
  id                     String       @id @default(cuid())
  fullName               String
  // Unique identity key across all providers:
  //   Google / LinkedIn / Apple → actual email      (e.g. rahul@gmail.com)
  //   X                         → handle only       (e.g. rahulsingh2k10)
  //   No clash possible: emails always contain @, X handles never do.
  username               String       @unique
  platform               String       // "Google" | "X" | "LinkedIn" | "Apple"
  avatar                 String?      // OAuth-provided URL or user-uploaded base64 data URL
  subscription           Subscription @default(FREE)
  subscriptionStartedAt  DateTime?
  subscriptionExpiresAt  DateTime?
  // AES-256-GCM encrypted verifier — encrypt("PORTFOLIO_APP_V1", derivedKey)
  // null  → first-time setup; non-null → passphrase already established
  // The passphrase itself is NEVER stored anywhere.
  verifier               String?
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  @@map("users")
}
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `cd frontend && npx prisma generate`
Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Push the schema to the live database**

Run: `cd frontend && npx prisma db push`
Expected: Output ending in `Your database is now in sync with your Prisma schema.` This
drops the old `plan` column (and its `Plan` enum type) and creates `subscription`,
`subscriptionStartedAt`, `subscriptionExpiresAt` on the `users` table — confirmed
acceptable since there is no production user data yet.

- [ ] **Step 5: Commit**

```bash
git add frontend/prisma/schema.prisma backend/prisma/schema.prisma
git commit -m "Replace User.plan with User.subscription (FREE/MONTHLY/QUARTERLY/ANNUAL)"
```

---

### Task 2: Rename the field in UserRepository, with a test

**Files:**
- Modify: `frontend/src/lib/repositories/UserRepository.ts:9-16`
- Create: `frontend/__tests__/repositories/UserRepository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/__tests__/repositories/UserRepository.test.ts`:

```typescript
import { UserRepository } from '@/lib/repositories/UserRepository'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      upsert: jest.fn().mockResolvedValue({
        id: 'u1',
        fullName: 'Test User',
        username: 'test@example.com',
        avatar: null,
      }),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('UserRepository.upsert', () => {
  it('creates a new user with subscription defaulted to FREE', async () => {
    const repo = new UserRepository()

    await repo.upsert({ id: 'test@example.com', fullName: 'Test User', platform: 'Google' })

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ subscription: 'FREE' }),
      })
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest __tests__/repositories/UserRepository.test.ts`
Expected: FAIL — the mocked `upsert` was called with `plan: 'FREE'`, not
`subscription: 'FREE'`, so `toHaveBeenCalledWith` doesn't match.

- [ ] **Step 3: Rename the field in `UserRepository.ts`**

In `frontend/src/lib/repositories/UserRepository.ts`, change line 13 from:

```typescript
      create: { username: profile.id, fullName: profile.fullName, platform: profile.platform, avatar: profile.avatar, plan: 'FREE' },
```

to:

```typescript
      create: { username: profile.id, fullName: profile.fullName, platform: profile.platform, avatar: profile.avatar, subscription: 'FREE' },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest __tests__/repositories/UserRepository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/repositories/UserRepository.ts frontend/__tests__/repositories/UserRepository.test.ts
git commit -m "Rename UserRepository.upsert plan field to subscription"
```

---

### Task 3: Rename the field in the four OAuth callback routes

**Files:**
- Modify: `frontend/src/app/api/auth/google/callback/route.ts:90`
- Modify: `frontend/src/app/api/auth/apple/callback/route.ts:101`
- Modify: `frontend/src/app/api/auth/x/callback/route.ts:93`
- Modify: `frontend/src/app/api/auth/linkedin/callback/route.ts:87`

These routes have no existing test coverage (consistent with the rest of the OAuth flow) —
this task is a mechanical rename verified by TypeScript, not a new test.

- [ ] **Step 1: Update `google/callback/route.ts`**

Change line 90 from:

```typescript
      create: { username: userInfo.email, fullName, platform: "Google", avatar: userInfo.picture || undefined, plan: "FREE" },
```

to:

```typescript
      create: { username: userInfo.email, fullName, platform: "Google", avatar: userInfo.picture || undefined, subscription: "FREE" },
```

- [ ] **Step 2: Update `apple/callback/route.ts`**

Change line 101 from:

```typescript
      create: { username: appleUsername, fullName, platform: "Apple", plan: "FREE" },
```

to:

```typescript
      create: { username: appleUsername, fullName, platform: "Apple", subscription: "FREE" },
```

- [ ] **Step 3: Update `x/callback/route.ts`**

Change line 93 from:

```typescript
      create: { username: handle, fullName: name, platform: "X", avatar: xAvatar, plan: "FREE" },
```

to:

```typescript
      create: { username: handle, fullName: name, platform: "X", avatar: xAvatar, subscription: "FREE" },
```

- [ ] **Step 4: Update `linkedin/callback/route.ts`**

Change line 87 from:

```typescript
      create: { username: userInfo.email, fullName, platform: "LinkedIn", avatar: userInfo.picture || undefined, plan: "FREE" },
```

to:

```typescript
      create: { username: userInfo.email, fullName, platform: "LinkedIn", avatar: userInfo.picture || undefined, subscription: "FREE" },
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors referencing `plan` in any of the four callback routes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/api/auth/google/callback/route.ts frontend/src/app/api/auth/apple/callback/route.ts frontend/src/app/api/auth/x/callback/route.ts frontend/src/app/api/auth/linkedin/callback/route.ts
git commit -m "Rename plan to subscription in OAuth callback user creation"
```

---

### Task 4: Rename the field in the `/api/auth/me` route

**Files:**
- Modify: `frontend/src/app/api/auth/me/route.ts:34`

- [ ] **Step 1: Update the response payload**

In `frontend/src/app/api/auth/me/route.ts`, change line 34 from:

```typescript
      plan: dbUser.plan,
```

to:

```typescript
      subscription: dbUser.subscription,
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors in `route.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/auth/me/route.ts
git commit -m "Return subscription instead of plan from /api/auth/me"
```

---

### Task 5: Rename the field in `Sidebar.tsx`

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx:24-28,32-37,123-124`

- [ ] **Step 1: Rename `PLAN_LABELS` and update its values**

Change lines 24–28 from:

```typescript
const PLAN_LABELS: Record<string, string> = {
  FREE: "freePlan",
  PRO:  "proPlan",
  MAX:  "maxPlan",
};
```

to:

```typescript
const SUBSCRIPTION_LABELS: Record<string, string> = {
  FREE:      "freeSubscription",
  MONTHLY:   "monthlySubscription",
  QUARTERLY: "quarterlySubscription",
  ANNUAL:    "annualSubscription",
};
```

- [ ] **Step 2: Rename `UserInfo.plan`**

Change lines 32–37 from:

```typescript
interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  plan?: string;
}
```

to:

```typescript
interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  subscription?: string;
}
```

- [ ] **Step 3: Rename `planKey`/`planLabel` and their usages**

Change lines 123–124 from:

```typescript
  const planKey   = PLAN_LABELS[user?.plan ?? "FREE"] as keyof typeof t.sidebar;
  const planLabel = t.sidebar[planKey] ?? t.sidebar.freePlan;
```

to:

```typescript
  const subscriptionKey   = SUBSCRIPTION_LABELS[user?.subscription ?? "FREE"] as keyof typeof t.sidebar;
  const subscriptionLabel = t.sidebar[subscriptionKey] ?? t.sidebar.freeSubscription;
```

- [ ] **Step 4: Update the two remaining usages**

Line 213 currently reads:

```typescript
                label={t.sidebar.plan}
```

Change it to:

```typescript
                label={t.sidebar.subscription}
```

Line 323 currently reads:

```typescript
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{planLabel}</p>
```

Change it to:

```typescript
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{subscriptionLabel}</p>
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Errors about missing `t.sidebar.subscription` / `t.sidebar.freeSubscription` /
`t.sidebar.monthlySubscription` / `t.sidebar.quarterlySubscription` /
`t.sidebar.annualSubscription` — these are resolved in Task 6. No other errors should
reference `Sidebar.tsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "Rename plan to subscription in Sidebar component"
```

---

### Task 6: Rename translation keys across all 11 locales

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

- [ ] **Step 1: Update the `Translations` interface**

Change lines 28–38 from:

```typescript
  sidebar: {
    settings:   string;
    language:   string;
    country:    string;
    plan:       string;
    lockScreen: string;
    logout:     string;
    freePlan:   string;
    proPlan:    string;
    maxPlan:    string;
  };
```

to:

```typescript
  sidebar: {
    settings:             string;
    language:             string;
    country:              string;
    subscription:         string;
    lockScreen:           string;
    logout:               string;
    freeSubscription:     string;
    monthlySubscription:  string;
    quarterlySubscription: string;
    annualSubscription:   string;
  };
```

- [ ] **Step 2: Update the `en-US` block**

Change lines 77–82 from:

```typescript
      plan:       "Plan",
      lockScreen: "Lock Screen",
      logout:     "Log out",
      freePlan:   "Free plan",
      proPlan:    "Pro plan",
      maxPlan:    "Max plan",
```

to:

```typescript
      subscription:          "Subscription",
      lockScreen:            "Lock Screen",
      logout:                "Log out",
      freeSubscription:      "Free subscription",
      monthlySubscription:   "Monthly subscription",
      quarterlySubscription: "Quarterly subscription",
      annualSubscription:    "Annual subscription",
```

- [ ] **Step 3: Update the `fr-FR` block**

Change lines 105–110 from:

```typescript
      plan:       "Forfait",
      lockScreen: "Verrouiller l'écran",
      logout:     "Déconnexion",
      freePlan:   "Forfait gratuit",
      proPlan:    "Forfait Pro",
      maxPlan:    "Forfait Max",
```

to:

```typescript
      subscription:          "Abonnement",
      lockScreen:            "Verrouiller l'écran",
      logout:                "Déconnexion",
      freeSubscription:      "Abonnement gratuit",
      monthlySubscription:   "Abonnement mensuel",
      quarterlySubscription: "Abonnement trimestriel",
      annualSubscription:    "Abonnement annuel",
```

- [ ] **Step 4: Update the `de-DE` block**

Change lines 133–138 from:

```typescript
      plan:       "Tarif",
      lockScreen: "Bildschirm sperren",
      logout:     "Abmelden",
      freePlan:   "Kostenloser Tarif",
      proPlan:    "Pro-Tarif",
      maxPlan:    "Max-Tarif",
```

to:

```typescript
      subscription:          "Abonnement",
      lockScreen:            "Bildschirm sperren",
      logout:                "Abmelden",
      freeSubscription:      "Kostenloses Abonnement",
      monthlySubscription:   "Monatliches Abonnement",
      quarterlySubscription: "Vierteljährliches Abonnement",
      annualSubscription:    "Jährliches Abonnement",
```

- [ ] **Step 5: Update the `hi-IN` block**

Change lines 161–166 from:

```typescript
      plan:       "योजना",
      lockScreen: "स्क्रीन लॉक करें",
      logout:     "लॉग आउट",
      freePlan:   "निःशुल्क योजना",
      proPlan:    "प्रो योजना",
      maxPlan:    "मैक्स योजना",
```

to:

```typescript
      subscription:          "सदस्यता",
      lockScreen:            "स्क्रीन लॉक करें",
      logout:                "लॉग आउट",
      freeSubscription:      "निःशुल्क सदस्यता",
      monthlySubscription:   "मासिक सदस्यता",
      quarterlySubscription: "त्रैमासिक सदस्यता",
      annualSubscription:    "वार्षिक सदस्यता",
```

- [ ] **Step 6: Update the `id-ID` block**

Change lines 189–194 from:

```typescript
      plan:       "Paket",
      lockScreen: "Kunci Layar",
      logout:     "Keluar",
      freePlan:   "Paket Gratis",
      proPlan:    "Paket Pro",
      maxPlan:    "Paket Max",
```

to:

```typescript
      subscription:          "Langganan",
      lockScreen:            "Kunci Layar",
      logout:                "Keluar",
      freeSubscription:      "Langganan Gratis",
      monthlySubscription:   "Langganan Bulanan",
      quarterlySubscription: "Langganan Triwulanan",
      annualSubscription:    "Langganan Tahunan",
```

- [ ] **Step 7: Update the `it-IT` block**

Change lines 217–222 from:

```typescript
      plan:       "Piano",
      lockScreen: "Blocca schermo",
      logout:     "Esci",
      freePlan:   "Piano gratuito",
      proPlan:    "Piano Pro",
      maxPlan:    "Piano Max",
```

to:

```typescript
      subscription:          "Abbonamento",
      lockScreen:            "Blocca schermo",
      logout:                "Esci",
      freeSubscription:      "Abbonamento gratuito",
      monthlySubscription:   "Abbonamento mensile",
      quarterlySubscription: "Abbonamento trimestrale",
      annualSubscription:    "Abbonamento annuale",
```

- [ ] **Step 8: Update the `ja-JP` block**

Change lines 245–250 from:

```typescript
      plan:       "プラン",
      lockScreen: "画面をロック",
      logout:     "ログアウト",
      freePlan:   "無料プラン",
      proPlan:    "プロプラン",
      maxPlan:    "マックスプラン",
```

to:

```typescript
      subscription:          "サブスクリプション",
      lockScreen:            "画面をロック",
      logout:                "ログアウト",
      freeSubscription:      "無料サブスクリプション",
      monthlySubscription:   "月額サブスクリプション",
      quarterlySubscription: "四半期サブスクリプション",
      annualSubscription:    "年間サブスクリプション",
```

- [ ] **Step 9: Update the `ko-KR` block**

Change lines 273–278 from:

```typescript
      plan:       "플랜",
      lockScreen: "화면 잠금",
      logout:     "로그아웃",
      freePlan:   "무료 플랜",
      proPlan:    "프로 플랜",
      maxPlan:    "맥스 플랜",
```

to:

```typescript
      subscription:          "구독",
      lockScreen:            "화면 잠금",
      logout:                "로그아웃",
      freeSubscription:      "무료 구독",
      monthlySubscription:   "월간 구독",
      quarterlySubscription: "분기 구독",
      annualSubscription:    "연간 구독",
```

- [ ] **Step 10: Update the `pt-BR` block**

Change lines 301–306 from:

```typescript
      plan:       "Plano",
      lockScreen: "Bloquear tela",
      logout:     "Sair",
      freePlan:   "Plano gratuito",
      proPlan:    "Plano Pro",
      maxPlan:    "Plano Max",
```

to:

```typescript
      subscription:          "Assinatura",
      lockScreen:            "Bloquear tela",
      logout:                "Sair",
      freeSubscription:      "Assinatura gratuita",
      monthlySubscription:   "Assinatura mensal",
      quarterlySubscription: "Assinatura trimestral",
      annualSubscription:    "Assinatura anual",
```

- [ ] **Step 11: Update the `es-419` block**

Change lines 329–334 from:

```typescript
      plan:       "Plan",
      lockScreen: "Bloquear pantalla",
      logout:     "Cerrar sesión",
      freePlan:   "Plan gratuito",
      proPlan:    "Plan Pro",
      maxPlan:    "Plan Max",
```

to:

```typescript
      subscription:          "Suscripción",
      lockScreen:            "Bloquear pantalla",
      logout:                "Cerrar sesión",
      freeSubscription:      "Suscripción gratuita",
      monthlySubscription:   "Suscripción mensual",
      quarterlySubscription: "Suscripción trimestral",
      annualSubscription:    "Suscripción anual",
```

- [ ] **Step 12: Update the `es-ES` block**

Change lines 357–362 from:

```typescript
      plan:       "Plan",
      lockScreen: "Bloquear pantalla",
      logout:     "Cerrar sesión",
      freePlan:   "Plan gratuito",
      proPlan:    "Plan Pro",
      maxPlan:    "Plan Max",
```

to:

```typescript
      subscription:          "Suscripción",
      lockScreen:            "Bloquear pantalla",
      logout:                "Cerrar sesión",
      freeSubscription:      "Suscripción gratuita",
      monthlySubscription:   "Suscripción mensual",
      quarterlySubscription: "Suscripción trimestral",
      annualSubscription:    "Suscripción anual",
```

- [ ] **Step 13: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors anywhere in the project.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/i18n/translations.ts
git commit -m "Rename plan translation keys to subscription across all locales"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd frontend && npx jest`
Expected: All tests pass, including the new `UserRepository.test.ts`.

- [ ] **Step 2: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Production build**

Run: `cd frontend && npm run build`
Expected: Build completes successfully with no type or lint errors.

- [ ] **Step 4: Manual verification in the running app**

Run: `cd frontend && npm run dev`, then open the app in a browser, log in (or use an
existing session), open the sidebar profile popover, and confirm:
- The profile row under the user's name shows "Free subscription" (not a blank label or
  a raw key like `freeSubscription`)
- The sheet menu row that used to read "Plan" now reads "Subscription"
- No console errors on page load

Use `npx prisma studio` (from `frontend/`) to inspect the `users` table directly and
confirm the `subscription` column exists with value `FREE` for existing rows, and that
`subscriptionStartedAt`/`subscriptionExpiresAt` exist and are `NULL`.
