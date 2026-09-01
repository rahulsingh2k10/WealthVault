"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import type { UpgradePromptData } from "@/lib/services/UpgradePromptService";

/**
 * A button that opens the same UpgradeModal used by the dashboard's
 * UpgradePrompt, for a FREE-tier user visiting the Manage Subscription
 * screen directly (rather than waiting for the timed dashboard prompt).
 */
export function OpenUpgradeModalButton({ plans, memberCount }: UpgradePromptData) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-4 py-2.5 text-sm font-bold"
        style={{
          background: "linear-gradient(135deg, var(--ui-accent), var(--ui-accent-warm))",
          color: "var(--ui-on-accent)",
        }}
      >
        {t.manageSubscription.freeUpgradeCta}
      </button>
      <UpgradeModal
        open={open}
        plans={plans}
        memberCount={memberCount}
        onClose={() => setOpen(false)}
        onSubscribed={() => router.refresh()}
      />
    </>
  );
}
