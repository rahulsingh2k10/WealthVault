"use client";

import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import type { CategorySummary } from "@/lib/types";
import { ASSET_COLORS, ASSET_COLOR_LIST } from "@/lib/utils";

const CATEGORY_ROUTES: Record<string, string> = {
  Holdings: "/holdings",
  "Mutual Funds": "/mutual-funds",
  NPS: "/nps",
  Cryptocurrency: "/crypto",
  "Post Office": "/post-office",
  "FD/RD/PPF": "/fd-rd-ppf",
  "Foreign Holdings": "/foreign",
  Others: "/others",
};

interface CategoryCardsProps {
  categories: CategorySummary[];
}

export function CategoryCards({ categories }: CategoryCardsProps) {
  const { format } = useCurrency();

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Categories
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categories
          .filter((c) => c.purchaseAmount > 0)
          .map((cat, i) => {
            const isPos = cat.pnl >= 0;
            const href = CATEGORY_ROUTES[cat.name] ?? "/dashboard";
            const color = ASSET_COLORS[cat.name] ?? ASSET_COLOR_LIST[i % ASSET_COLOR_LIST.length];

            return (
              <Link
                key={cat.name}
                href={href as any}
                className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 dark:text-slate-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 line-clamp-1">
                  {cat.name}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                  {format(cat.currentAmount, true)}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {isPos ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${isPos ? "text-emerald-500" : "text-red-500"}`}>
                    {isPos ? "+" : ""}{(cat.netChange * 100).toFixed(1)}%
                  </span>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
