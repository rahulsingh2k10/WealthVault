"use client";

import { useRouter } from "next/navigation";
import { UpgradePlanPicker } from "@/components/dashboard/UpgradePlanPicker";
import type { UpgradePromptData } from "@/lib/services/UpgradePromptService";

/**
 * Renders the same hero/plan-picker content as the dashboard's UpgradeModal,
 * but inline on the Manage Subscription screen instead of as an overlay —
 * always visible for a FREE-tier user. Also shows the current FREE plan as
 * a fourth, non-purchasable "Current" tab/card (selected by default), which
 * the dashboard's prompt never shows. Widens (capped) to use more of the
 * page on large screens instead of leaving big side gaps; unchanged below
 * the `lg` breakpoint.
 */
export function FreeTierUpgradePanel({ plans, memberCount }: UpgradePromptData) {
  const router = useRouter();

  return (
    <div
      className="mx-auto flex w-full max-w-[960px] flex-col overflow-hidden rounded-3xl lg:max-w-[1100px] xl:max-w-[1280px]"
      style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
    >
      <UpgradePlanPicker
        plans={plans}
        memberCount={memberCount}
        onSubscribed={() => router.refresh()}
        currentTier="FREE"
      />
    </div>
  );
}
