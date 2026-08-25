"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useColorTheme, COLOR_THEMES, type ColorTheme } from "@/context/ColorThemeContext";

const SWATCH: Record<ColorTheme, string> = {
  warm:   "linear-gradient(135deg,#A83A2C,#E8A63C)",
  blue:   "linear-gradient(135deg,#0E3A6B,#2B84D9)",
  violet: "linear-gradient(135deg,#331E6E,#6339B0)",
  purple: "linear-gradient(135deg,#4A1170,#8B2FC9)",
  red:    "linear-gradient(135deg,#6B1010,#C7291F)",
  pink:   "linear-gradient(135deg,#7A1049,#D6318A)",
  teal:   "linear-gradient(135deg,#0D4F4C,#1FA187)",
  green:  "linear-gradient(135deg,#124A22,#34A853)",
  black:  "linear-gradient(135deg,#000000,#3A3A3A)",
};

const LABEL: Record<ColorTheme, string> = {
  warm: "Warm", blue: "Blue", violet: "Violet", purple: "Purple",
  red: "Red", pink: "Pink", teal: "Teal", green: "Green", black: "Black",
};

export function ThemePicker() {
  const { colorTheme, setColorTheme } = useColorTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-black/[.08] bg-black/[.02] py-1 pl-1 pr-2.5 transition hover:bg-black/[.05] dark:border-white/[.10] dark:bg-white/[.04] dark:hover:bg-white/[.08]"
      >
        <span
          className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
          style={{ background: SWATCH[colorTheme] }}
        />
        <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
          {LABEL[colorTheme]}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform dark:text-slate-500 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Landing page theme"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-black/[.08] bg-white p-3 shadow-xl dark:border-white/[.10] dark:bg-[#12172A]"
        >
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Landing page theme
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_THEMES.map((key) => {
              const active = colorTheme === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setColorTheme(key);
                    setOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition ${
                    active
                      ? "bg-black/[.05] dark:bg-white/[.08]"
                      : "hover:bg-black/[.03] dark:hover:bg-white/[.05]"
                  }`}
                >
                  <span
                    className="relative flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/15"
                    style={{ background: SWATCH[key] }}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
                  </span>
                  <span className="text-[10.5px] font-medium text-slate-600 dark:text-slate-300">
                    {LABEL[key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
