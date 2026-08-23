# Dynamic Navigation + Currency Simplification — Design

**Goal:** Make sidebar navigation dynamic based on the selected country. Remove the Currencies management page, its API routes, and the `currency_rates` database table. Eliminate all currency conversion — currency display is determined solely by the selected country, with no rate math.

**Architecture:** A new `navConfig.ts` module owns nav item definitions and country-to-section rules. `Sidebar.tsx` calls it with `country` from `useLocale()`. `CurrencyContext` is reduced to a pure country→currency formatter — no DB, no rates, no conversion.

---

## Problem Statement

### Current state
```
Sidebar navItems — static array, always shows all 11 items
CurrencyContext — fetches /api/currencies on mount, converts INR → any currency
```

### Target state
```
Sidebar nav — dynamic based on country:
  Universal (all):  Dashboard · Holdings · Mutual Funds · Crypto · Bank
  India (IN only):  + NPS · Post Office · FD/RD/PPF · Foreign Holdings · Others
  Removed:          Currencies

CurrencyContext — reads country → derives currency symbol + locale → formats only
  No fetching. No conversion. No rates. No DB.
```

---

## Design Decisions

### Decision 1 — Nav config extraction (unchanged from original)

A new `src/i18n/navConfig.ts` owns `getNavItems(country: string): NavItem[]`.

```typescript
UNIVERSAL = [Dashboard, Holdings, Mutual Funds, Crypto, Bank]
COUNTRY_NAV = { IN: [NPS, Post Office, FD/RD/PPF, Foreign, Others] }
getNavItems(country) = [...UNIVERSAL, ...(COUNTRY_NAV[country] ?? [])]
```

Countries with no entry get only the universal set — correct for all future additions.

### Decision 2 — No currency conversion, country drives display currency

**Rejected:** Static rate map with conversion.
**Chosen:** `CurrencyContext` becomes a pure formatter. It reads `country` from `LocaleContext`, maps it to a currency code and locale, then formats numbers using `Intl.NumberFormat`.

No rates. No conversion math. No fetching. No DB.

```typescript
// country = "IN" → format(100000) → "₹1,00,000"
// country = "US" → format(100000) → "$100,000.00"
```

**Important data model note:** All monetary values in the DB are stored in the user's own currency (India users store INR, US users would store USD). There is no INR→USD conversion because there is no cross-currency conversion at all. The display currency matches the storage currency by country.

### Decision 3 — Foreign holdings display

`ForeignPage` currently does:
```typescript
const usdRate = currencies.find((c) => c.currencyCode === 'USD')?.rate ?? 90
const fmtUsd = (usdAmount: number) => format(usdAmount * usdRate)
```

After the change: foreign holdings values are stored in USD (separate fields: `avgCostUsd`, `currentPriceUsd`, etc.). They should be displayed in USD regardless of the user's country, because that's what they are. `ForeignPage` gets its own local `fmtUsd` using `Intl.NumberFormat` directly — no context dependency.

```typescript
const fmtUsd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
```

`PortfolioService` still uses a hardcoded `DEFAULT_USD_RATE = 84` for portfolio aggregation (to express foreign holdings in local currency in the summary totals). This is a separate concern from display formatting.

### Decision 4 — `CurrencyContext` API surface after simplification

| Before | After |
|--------|-------|
| `currencies: CurrencyRate[]` | **removed** |
| `selectedCurrency: string` | **removed** |
| `setSelectedCurrency(code)` | **removed** |
| `refetchCurrencies()` | **removed** |
| `convert(inrAmount): number` | **removed** |
| `rate: number` | **removed** |
| `format(amount, compact?): string` | **kept** (same signature) |
| `symbol: string` | **kept** |

All 9 asset pages + dashboard components call only `format()`. They all continue working with zero changes.

`ForeignPage` was the only caller of `currencies` — it switches to its own local `fmtUsd`.

### Decision 5 — Country → currency mapping

Stored as a constant in `CurrencyContext.tsx`:

```typescript
const COUNTRY_CURRENCY: Record<string, { code: string; locale: string }> = {
  IN: { code: 'INR', locale: 'en-IN' },
  US: { code: 'USD', locale: 'en-US' },
  GB: { code: 'GBP', locale: 'en-GB' },
  EU: { code: 'EUR', locale: 'de-DE' },  // generic EU
  DE: { code: 'EUR', locale: 'de-DE' },
  FR: { code: 'EUR', locale: 'fr-FR' },
  AU: { code: 'AUD', locale: 'en-AU' },
  CA: { code: 'CAD', locale: 'en-CA' },
  JP: { code: 'JPY', locale: 'ja-JP' },
  SG: { code: 'SGD', locale: 'en-SG' },
  AE: { code: 'AED', locale: 'ar-AE' },
  CH: { code: 'CHF', locale: 'de-CH' },
  NZ: { code: 'NZD', locale: 'en-NZ' },
  // fallback: any unrecognised country → INR
}
```

`format(amount, compact?)` uses `Intl.NumberFormat` with the country's `code` and `locale`. For compact mode, it applies the country-appropriate suffix (Cr/L/K for INR, B/M/K for others).

---

## File Map — Changes

### New file

| File | Purpose |
|------|---------|
| `src/i18n/navConfig.ts` | `NavItem` type + `getNavItems(country)` |

### Modified files

| File | What changes |
|------|-------------|
| `src/components/layout/Sidebar.tsx` | Replace static `navItems` with `getNavItems(country)`; remove `BadgeDollarSign` import |
| `src/context/CurrencyContext.tsx` | Replace entire fetch/rate/conversion logic with country→currency map; remove `CurrencyRate` type export; remove `currencies`, `selectedCurrency`, `setSelectedCurrency`, `refetchCurrencies`, `convert`, `rate` |
| `src/app/foreign/page.tsx` | Remove `currencies` from `useCurrency()` destructure; add local `fmtUsd` with Intl.NumberFormat |
| `src/lib/services/PortfolioService.ts` | Remove `ICurrencyRepository` parameter; use `const DEFAULT_USD_RATE = 84` |
| `src/lib/interfaces/IPortfolioService.ts` | Remove `ICurrencyRepository` from constructor signature |
| `src/app/dashboard/page.tsx` | Remove `CurrencyRepository` import and instantiation |
| `prisma/schema.prisma` | Remove `CurrencyRate` model |
| `src/i18n/translations.ts` | Remove `nav.currencies` from interface + all locale objects |

### Deleted files

```
src/app/currencies/page.tsx
src/app/api/currencies/route.ts
src/app/api/currencies/[id]/route.ts
src/app/api/currencies/populate/route.ts
src/app/api/currencies/.DS_Store
src/lib/repositories/CurrencyRepository.ts
src/lib/interfaces/ICurrencyRepository.ts
```

---

## LLD — `src/i18n/navConfig.ts`

```typescript
import {
  LayoutDashboard, TrendingUp, BarChart3, Bitcoin, Building2,
  Landmark, Mail, PiggyBank, Globe, Shield,
} from 'lucide-react'
import type { ElementType } from 'react'

export interface NavItem {
  href:      string
  labelKey:  keyof Translations['nav']   // e.g. 'dashboard', 'nps'
  icon:      ElementType
}

const UNIVERSAL: NavItem[] = [
  { href: '/dashboard',    labelKey: 'dashboard',   icon: LayoutDashboard },
  { href: '/holdings',     labelKey: 'holdings',    icon: TrendingUp      },
  { href: '/mutual-funds', labelKey: 'mutualFunds', icon: BarChart3       },
  { href: '/crypto',       labelKey: 'crypto',      icon: Bitcoin         },
  { href: '/bank',         labelKey: 'bank',        icon: Building2       },
]

const INDIA: NavItem[] = [
  { href: '/nps',         labelKey: 'nps',       icon: Landmark  },
  { href: '/post-office', labelKey: 'postOffice', icon: Mail      },
  { href: '/fd-rd-ppf',   labelKey: 'fdRdPpf',   icon: PiggyBank },
  { href: '/foreign',     labelKey: 'foreign',    icon: Globe     },
  { href: '/others',      labelKey: 'others',     icon: Shield    },
]

const COUNTRY_NAV: Record<string, NavItem[]> = {
  IN: INDIA,
}

export function getNavItems(country: string): NavItem[] {
  return [...UNIVERSAL, ...(COUNTRY_NAV[country] ?? [])]
}
```

---

## LLD — `CurrencyContext.tsx` (simplified)

```typescript
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useLocale } from '@/context/LocaleContext'

interface CurrencyContextValue {
  format: (amount: number, compact?: boolean) => string
  symbol: string
}

const COUNTRY_CURRENCY: Record<string, { code: string; locale: string }> = {
  IN: { code: 'INR', locale: 'en-IN' },
  US: { code: 'USD', locale: 'en-US' },
  GB: { code: 'GBP', locale: 'en-GB' },
  DE: { code: 'EUR', locale: 'de-DE' },
  FR: { code: 'EUR', locale: 'fr-FR' },
  AU: { code: 'AUD', locale: 'en-AU' },
  CA: { code: 'CAD', locale: 'en-CA' },
  JP: { code: 'JPY', locale: 'ja-JP' },
  SG: { code: 'SGD', locale: 'en-SG' },
  AE: { code: 'AED', locale: 'ar-AE' },
  CH: { code: 'CHF', locale: 'de-CH' },
  NZ: { code: 'NZD', locale: 'en-NZ' },
}
const DEFAULT_CURRENCY = { code: 'INR', locale: 'en-IN' }

const CurrencyContext = createContext<CurrencyContextValue>({
  format: (v) => `₹${v.toFixed(2)}`,
  symbol: '₹',
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { country } = useLocale()
  const { code, locale } = COUNTRY_CURRENCY[country] ?? DEFAULT_CURRENCY

  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency: code })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? code

  const format = (amount: number, compact = false): string => {
    if (compact) {
      const abs = Math.abs(amount)
      if (code === 'INR') {
        if (abs >= 10_000_000) return `${symbol}${(amount / 10_000_000).toFixed(2)}Cr`
        if (abs >= 100_000)   return `${symbol}${(amount / 100_000).toFixed(2)}L`
        if (abs >= 1_000)     return `${symbol}${(amount / 1_000).toFixed(2)}K`
      } else {
        if (abs >= 1_000_000_000) return `${symbol}${(amount / 1_000_000_000).toFixed(2)}B`
        if (abs >= 1_000_000)     return `${symbol}${(amount / 1_000_000).toFixed(2)}M`
        if (abs >= 1_000)         return `${symbol}${(amount / 1_000).toFixed(2)}K`
      }
    }
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <CurrencyContext.Provider value={{ format, symbol }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
```

`CurrencyProvider` no longer needs `useState` or `useEffect` — it is now a pure, synchronous derivation from `useLocale()`. No network call, no localStorage, no re-renders from async state.

---

## LLD — `ForeignPage` change

```typescript
// Remove from useCurrency() destructure:
// const { currencies, format } = useCurrency()

// After:
const { format } = useCurrency()

// Remove:
// const usdRate = currencies.find((c) => c.currencyCode === 'USD')?.rate ?? 90
// const fmtUsd = (usdAmount: number) => format(usdAmount * usdRate)

// Add:
const fmtUsd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v)
```

Summary cards in `ForeignPage` already use `fmtUsd`, so they continue working. The global `format()` is not used in `ForeignPage` at all after this change.

---

## LLD — `PortfolioService` change

```typescript
// Remove ICurrencyRepository parameter
// Remove: const usdRate = await currencyRepo.findByCode('USD')

const DEFAULT_USD_RATE = 84   // INR per 1 USD — for portfolio aggregation only

// In getSummary(): use DEFAULT_USD_RATE instead of fetched rate
const foreignInr = foreignHoldings.reduce(
  (sum, h) => sum + (h.currentAmountUsd * DEFAULT_USD_RATE), 0
)
```

---

## Database Migration

```sql
DROP TABLE IF EXISTS currency_rates;
```

Prisma migration: remove `CurrencyRate` model from `schema.prisma`, run `prisma migrate dev --name remove_currency_rates`.

---

## What stays the same

- All 9 asset pages — no changes except `ForeignPage` (one small edit)
- `format(amount, compact?)` call signature — identical in all callers
- `useCurrency()` — same import everywhere, just returns fewer fields
- `AppShell`, dashboard components, `SummaryCards`, charts — unchanged
- Country picker in sidebar profile sheet — still works; country change triggers a re-render of `CurrencyProvider` which re-derives the currency
- All translation keys except `nav.currencies` — unchanged
