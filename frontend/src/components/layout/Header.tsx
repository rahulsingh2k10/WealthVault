"use client";

import { RefreshCw, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();

  const handleLock = async () => {
    await fetch("/api/auth/lock", { method: "POST" });
    router.push("/unlock");
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      <div>
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50 leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{subtitle}</p>
        )}
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
