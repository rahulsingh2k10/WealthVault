"use client";

import { useEffect, useRef } from "react";

const TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS) || 60_000;

/**
 * Mounts invisibly inside authenticated pages.
 * Any mouse move, key press, click, scroll, or touch resets the timer.
 * After TIMEOUT_MS of silence → POST /api/auth/lock → navigate to /unlock.
 */
export function InactivityLock() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const lock = async () => {
      try {
        await fetch("/api/auth/lock", { method: "POST" });
      } catch {
        // best-effort
      }
      window.location.href = "/unlock";
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(lock, TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    // Start the timer immediately on mount
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  return null;
}
