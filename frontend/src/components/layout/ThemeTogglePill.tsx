"use client";

/**
 * ThemeTogglePill — exact port of PPP ThemeToggle.js
 *
 * Layout: [Dark] [pill-switch] [Light]
 *  • Knob left  (translate-x-1) → dark mode  → Moon icon inside knob
 *  • Knob right (translate-x-6) → light mode → Sun  icon inside knob
 *  • Active label: opacity-100 · Inactive label: opacity-50
 *
 * Colours from ThemeContext.js:
 *   track dark  : #2563eb  (primary blue)
 *   track light : #10b981  (accent green)
 *   text  dark  : #f8fafc  (near-white)
 *   text  light : #1c1917  (warm-black)
 */

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { savePreference } from "@/lib/savePreference";

export function ThemeTogglePill() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-7 w-32 rounded-full bg-slate-700/40 animate-pulse" />;
  }

  const isDark = theme === "dark";
  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    savePreference('theme', next);
  };
  const trackBg  = isDark ? "#2563eb" : "#10b981";
  const labelCol = isDark ? "#f8fafc"  : "#1c1917";

  return (
    <div className="flex items-center space-x-3">

      {/* Dark label */}
      <span
        className={`text-[10px] font-bold transition-all duration-300 select-none ${
          isDark ? "opacity-100" : "opacity-50"
        }`}
        style={{ color: labelCol }}
      >
        Dark
      </span>

      {/* Pill track */}
      <button
        onClick={toggle}
        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none"
        style={{ backgroundColor: trackBg }}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        {/* Sliding knob */}
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${
            isDark ? "translate-x-1" : "translate-x-6"
          }`}
        >
          <div className="flex h-full w-full items-center justify-center">
            {isDark ? (
              <Moon className="h-3 w-3 text-gray-600" />
            ) : (
              <Sun className="h-3 w-3 text-yellow-500" />
            )}
          </div>
        </span>
      </button>

      {/* Light label */}
      <span
        className={`text-[10px] font-bold transition-all duration-300 select-none ${
          !isDark ? "opacity-100" : "opacity-50"
        }`}
        style={{ color: labelCol }}
      >
        Light
      </span>

    </div>
  );
}
