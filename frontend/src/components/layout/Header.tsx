"use client";

import { RefreshCw, Lock, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMobileNav } from "@/context/MobileNavContext";

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":           { title: "Dashboard" },
  "/stocks":              { title: "Stocks" },
  "/mutual-funds":        { title: "Mutual Funds", subtitle: "Index funds and active funds via Coin by Zerodha" },
  "/gold-commodities":    { title: "Gold & Commodities" },
  "/real-estate":         { title: "Real Estate" },
  "/crypto":              { title: "Cryptocurrency", subtitle: "CoinSwitch and WazirX holdings" },
  "/insurance":           { title: "Insurance" },
  "/cash-banking":        { title: "Cash & Banking" },
  "/liabilities":         { title: "Liabilities" },
  "/fixed-income":        { title: "Fixed Income" },
  "/government-schemes":  { title: "Government Schemes" },
  "/settings":            { title: "Settings" },
  "/subscription":        { title: "Manage Subscription" },
  "/bank":                { title: "Bank Accounts", subtitle: "Savings and current account balances" },
  "/fd-rd-ppf":           { title: "FD / RD / PPF", subtitle: "Fixed deposits, recurring deposits, and PPF accounts" },
  "/foreign":             { title: "Foreign Holdings", subtitle: "US stocks via IndMoney and Vested" },
  "/holdings":            { title: "Holdings", subtitle: "Indian equity positions" },
  "/nps":                 { title: "NPS", subtitle: "National Pension System — SBI Pension Fund (CDSL)" },
  "/others":              { title: "Others (LIC & Insurance)", subtitle: "Life insurance and other long-term investments" },
  "/post-office":         { title: "Post Office", subtitle: "KVP, NSC, and other post office schemes" },
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const { title, subtitle } = PAGE_META[pathname] ?? { title: "" };

  const handleLock = async () => {
    await fetch("/api/auth/lock", { method: "POST" });
    router.push("/unlock");
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>

        <button
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400 transition-colors"
          onClick={handleLock}
        >
          <Lock className="h-3.5 w-3.5" />
          Lock
        </button>
      </div>
    </header>
  );
}
