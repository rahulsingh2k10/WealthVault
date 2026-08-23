"use client";

/**
 * ProfileBadge — exact 1:1 port from
 * PurchasingPowerParity/frontend/src/App.js (lines 342-395)
 *
 * All colours taken verbatim from ThemeContext.js:
 *   dark:  primary #2563eb · secondary #f59e0b · green #10b981 · bg #0f172a
 *   light: primary #0d9488 · secondary #f97316 · green #10b981 · bg #fafaf9
 *
 * Only adaptations made for Next.js/TS:
 *   - custom useTheme (React context) → next-themes useTheme + mounted guard
 *   - keyframe names prefixed "rs-" to avoid Tailwind animation conflicts
 *   - JSX className stays identical; inline styles identical
 */

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ProfileBadge() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDarkMode = !mounted || theme === "dark";

  /* ── Exact colour tokens from ThemeContext.js ───────────────────── */
  const primary    = isDarkMode ? "#2563eb" : "#0d9488";
  const secondary  = isDarkMode ? "#f59e0b" : "#f97316";
  const green      = "#10b981";
  const bgMain     = isDarkMode ? "#0f172a" : "#fafaf9";
  const boxShadow  = isDarkMode
    ? "0 0 12px rgba(59, 130, 246, 0.5)"
    : "0 0 12px rgba(13, 148, 136, 0.5)";

  return (
    <>
      {/* Keyframes — prefixed rs- to avoid Tailwind's own spin/pulse names */}
      <style>{`
        @keyframes rs-badge-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes rs-badge-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>

      {/* ── Exact JSX from App.js ─────────────────────────────────── */}
      <a
        href="https://rahulsingh.ai/dossier"
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center justify-center cursor-pointer group"
        style={{ width: "40px", height: "40px" }}
      >
        {/* Animated ring */}
        <div
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background: `conic-gradient(from 0deg, ${primary}, ${green}, ${secondary}, ${primary})`,
            animation: "rs-badge-spin 3s linear infinite",
          }}
        />

        {/* Inner background (separator gap) */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "2px",
            background: bgMain,
          }}
        />

        {/* RS Badge */}
        <div
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold z-10 transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
            color: "white",
            boxShadow,
            letterSpacing: "0.5px",
          }}
        >
          RS
        </div>

        {/* External link indicator — always visible */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
          style={{
            background: green,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            border: `1.5px solid ${bgMain}`,
          }}
        >
          <svg
            className="w-2 h-2"
            fill="none"
            stroke="white"
            viewBox="0 0 24 24"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 19L19 5M19 5v10M19 5H9"
            />
          </svg>
        </div>

        {/* Pulse effect */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${primary}40, ${secondary}40)`,
            animation: "rs-badge-pulse 2s ease-in-out infinite",
          }}
        />
      </a>
    </>
  );
}
