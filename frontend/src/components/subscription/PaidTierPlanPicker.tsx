"use client";

import { UpgradePlanPicker } from "@/components/dashboard/UpgradePlanPicker";
import type { PaidTier, PlanCardView } from "@/lib/services/UpgradePromptService";

interface PaidTierPlanPickerProps {
  plans: PlanCardView[];
  currentTier: PaidTier;
  changingTier: PaidTier | null;
  onSelectPaidTier: (tier: PaidTier) => void;
  currentCardDetails: { statusLine: React.ReactNode; actions: React.ReactNode };
  disableNonCurrent?: boolean;
  pendingCard?: { tier: PaidTier; statusLine: React.ReactNode; footer: React.ReactNode };
  failedCard?: { tier: PaidTier; statusLine: React.ReactNode; footer: React.ReactNode };
}

/**
 * The same hero/plan-comparison cards as the FREE-tier panel, reused for an
 * already-paid user on the Manage Subscription screen: their current tier's
 * card shows live account status and actions (cancel/resume/retry) in place
 * of the plain "Current plan" label, and picking a different card runs the
 * caller's change-plan flow instead of starting a fresh checkout.
 */
export function PaidTierPlanPicker({
  plans,
  currentTier,
  changingTier,
  onSelectPaidTier,
  currentCardDetails,
  disableNonCurrent,
  pendingCard,
  failedCard,
}: PaidTierPlanPickerProps) {
  return (
    <div
      className="mx-auto flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl lg:max-w-[860px] xl:max-w-[1000px]"
      style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
    >
      <UpgradePlanPicker
        plans={plans}
        memberCount={null}
        currentTier={currentTier}
        onSelectPaidTier={onSelectPaidTier}
        externalSubmittingTier={changingTier}
        currentCardDetails={currentCardDetails}
        disableNonCurrent={disableNonCurrent}
        pendingCard={pendingCard}
        failedCard={failedCard}
      />
    </div>
  );
}
