import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian Rupees (₹)
 */
export function formatINR(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)}Cr`;
    } else if (Math.abs(value) >= 100000) {
      return `₹${(value / 100000).toFixed(2)}L`;
    } else if (Math.abs(value) >= 1000) {
      return `₹${(value / 1000).toFixed(2)}K`;
    }
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as USD ($)
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a return ratio as a percentage (e.g. 0.3 → "+30.00%")
 */
export function formatReturn(netChange: number): string {
  const pct = netChange * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Format a plain percentage number (e.g. 12.4 → "+1240.00%")
 * netChange in the dataset is P&L/purchaseAmount (a ratio × 1)
 */
export function formatChangeRatio(ratio: number): string {
  const pct = ratio * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Determine if a value is positive, negative, or neutral
 */
export function pnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-slate-400";
}

/**
 * Format a date as a readable string
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculate days remaining to a future date (negative = overdue)
 */
export function daysRemaining(endDate: Date | string): number {
  const end = new Date(endDate);
  const today = new Date();
  const diff = end.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Chart color palette for asset classes
 */
export const ASSET_COLORS: Record<string, string> = {
  Holdings: "#6366f1",
  "Mutual Funds": "#0ea5e9",
  NPS: "#f59e0b",
  Cryptocurrency: "#a855f7",
  "Post Office": "#10b981",
  "FD/RD/PPF": "#f97316",
  "Foreign Holdings": "#ec4899",
  Others: "#64748b",
  "Bank Balance": "#22c55e",
};

export const ASSET_COLOR_LIST = [
  "#6366f1", "#0ea5e9", "#f59e0b", "#a855f7",
  "#10b981", "#f97316", "#ec4899", "#64748b", "#22c55e", "#ef4444",
];

/**
 * Format a whole-unit money amount for display, e.g.
 *   formatMoney(1600, "INR")            → "₹1,600"
 *   formatMoney(1600, "USD", "en-US")   → "$1,600"
 * Unlike formatINR, this shows no decimal places — subscription prices are whole units.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale = "en-IN"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
