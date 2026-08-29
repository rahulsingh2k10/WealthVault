"use client";

import { useEffect, useState } from "react";
import { UpgradeModal } from "./UpgradeModal";
import type { UpgradePromptData } from "@/lib/services/UpgradePromptService";

const DISMISS_KEY = "wv:upgrade-prompt:dismissed";
const DELAY_MS = Number(process.env.NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS) || 6000;

/**
 * Owns the "when does the upgrade modal appear" logic and nothing visual.
 * Rendered by the dashboard server page only for FREE-tier users.
 * Opens the modal DELAY_MS after mount, unless already dismissed this session.
 * Any dismissal suppresses it for the rest of the browser session.
 */
export function UpgradePrompt({ plans, memberCount }: UpgradePromptData) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // sessionStorage unavailable (privacy mode) — just proceed to show it.
    }
    const id = setTimeout(() => setOpen(true), DELAY_MS);
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

  return <UpgradeModal open={open} plans={plans} memberCount={memberCount} onClose={close} />;
}
