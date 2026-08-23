import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "gain" | "loss" | "neutral" | "indigo" | "amber";
  className?: string;
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400": variant === "gain",
          "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400": variant === "loss",
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400": variant === "neutral",
          "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400": variant === "indigo",
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400": variant === "amber",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export function PnLBadge({ value }: { value: number }) {
  return (
    <Badge variant={value >= 0 ? "gain" : "loss"}>
      {value >= 0 ? "+" : ""}
      {(value * 100).toFixed(2)}%
    </Badge>
  );
}
