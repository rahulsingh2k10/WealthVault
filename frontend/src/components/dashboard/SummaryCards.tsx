"use client";

import { TrendingUp, TrendingDown, IndianRupee, Wallet, BarChart3, Building2 } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import type { PortfolioSummary } from "@/lib/types";

interface SummaryCardsProps {
  summary: PortfolioSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const { format } = useCurrency();
  const isPositive = summary.totalPnL >= 0;
  const returnPct = (summary.overallReturn * 100).toFixed(2);

  const cards = [
    {
      label: "Total Invested",
      value: format(summary.totalInvested, true),
      sub: "Across all categories",
      icon: Wallet,
      iconClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    },
    {
      label: "Current Value",
      value: format(summary.currentValue, true),
      sub: "Investments only",
      icon: BarChart3,
      iconClass: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
    },
    {
      label: "Total P&L",
      value: `${isPositive ? "+" : ""}${format(summary.totalPnL, true)}`,
      sub: `${isPositive ? "+" : ""}${returnPct}% overall return`,
      icon: isPositive ? TrendingUp : TrendingDown,
      iconClass: isPositive
        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
        : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
      valueClass: isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
    },
    {
      label: "Total Assets",
      value: format(summary.totalAssets, true),
      sub: `Bank: ${format(summary.bankBalance, true)}`,
      icon: IndianRupee,
      iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    },
    {
      label: "Bank Balance",
      value: format(summary.bankBalance, true),
      sub: "Liquid cash",
      icon: Building2,
      iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <p
                className={`mt-1 text-xl font-bold tracking-tight ${
                  card.valueClass ?? "text-slate-900 dark:text-slate-50"
                }`}
              >
                {card.value}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {card.sub}
              </p>
            </div>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconClass}`}>
              <card.icon className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
