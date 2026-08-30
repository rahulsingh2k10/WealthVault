"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "./UpgradeModal";
import type { UpgradePromptData } from "@/lib/services/UpgradePromptService";

const DISMISS_KEY = "wv:upgrade-prompt:dismissed";
const DEFAULT_DELAY_MS = Number(process.env.NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS) || 6000;

/** Delay before the modal opens. A `?wvUpgradePromptDelayMs=<n>` query param overrides
 *  it (used by e2e tests so they don't depend on a build-time env var). */
function resolveDelayMs(): number {
  if (typeof window !== "undefined") {
    const raw = new URLSearchParams(window.location.search).get("wvUpgradePromptDelayMs");
    if (raw !== null && /^\d+$/.test(raw)) return Number(raw);
  }
  return DEFAULT_DELAY_MS;
}

/**
 * Owns the "when does the upgrade modal appear" logic and nothing visual.
 * Rendered by the dashboard server page only for FREE-tier users.
 * Opens the modal DELAY_MS after mount, unless already dismissed this session.
 * Any dismissal suppresses it for the rest of the browser session.
 */
export function UpgradePrompt({ plans, memberCount }: UpgradePromptData) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // sessionStorage unavailable (privacy mode) — just proceed to show it.
    }
    const id = setTimeout(() => setOpen(true), resolveDelayMs());
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <UpgradeModal
      open={open}
      plans={plans}
      memberCount={memberCount}
      onClose={close}
      onSubscribed={() => {
        // No toast infrastructure exists yet in this codebase; router.refresh()
        // re-runs the dashboard server component so the paid-tier gate naturally
        // stops rendering this prompt.
        router.refresh();
      }}
    />
  );
}
