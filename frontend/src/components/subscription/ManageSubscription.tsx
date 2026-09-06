"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { PaidTierPlanPicker } from "./PaidTierPlanPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CURRENT_COLOR } from "@/components/dashboard/UpgradePlanPicker";
import { startCheckout } from "@/lib/payments/checkout";
import type { CheckoutParams } from "@/lib/payments/types";
import type { buildManageView, PaidPlanOption } from "@/lib/services/SubscriptionService";
import type { PaidTier, PlanCardView } from "@/lib/services/UpgradePromptService";

type ManageView = Exclude<Awaited<ReturnType<typeof buildManageView>>, { tier: "FREE" }>;

interface ManageSubscriptionProps {
  view: ManageView;
  paidPlans: PaidPlanOption[];
  planCards: PlanCardView[];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function ManageSubscription({ view, paidPlans, planCards }: ManageSubscriptionProps) {
  const { t, locale } = useLocale();
  const router = useRouter();

  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [accessUntil, setAccessUntil] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [changingTier, setChangingTier] = useState<PaidTier | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  const [cancellingScheduled, setCancellingScheduled] = useState(false);
  const [cancelScheduledError, setCancelScheduledError] = useState<string | null>(null);

  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    question: string;
    onConfirm: () => void;
  } | null>(null);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  const statusLabel =
    view.status === "pending"
      ? t.manageSubscription.statusPending
      : view.status === "cancelled" || view.status === "completed"
        ? t.manageSubscription.statusCancelled
        : t.manageSubscription.statusActive;

  const alreadyCancelled = cancelled || view.cancelAtCycleEnd;
  const effectiveAccessUntil = accessUntil ?? (view.cancelAtCycleEnd ? view.currentEnd : null);

  const doCancel = async () => {
    setCancelError(null);
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        setCancelError("Something went wrong. Please try again.");
        return;
      }
      const data = (await res.json()) as { accessUntil: string | null };
      setAccessUntil(data.accessUntil);
      setCancelled(true);
      router.refresh();
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleCancel = () => {
    const body = view.currentEnd
      ? interpolate(t.manageSubscription.cancelConfirmBody, { plan: view.planName, date: fmtDate(view.currentEnd) })
      : t.manageSubscription.cancelConfirmTitle;
    setConfirmDialog({
      title: t.manageSubscription.cancelConfirmTitle,
      body,
      question: t.manageSubscription.confirmQuestion,
      onConfirm: doCancel,
    });
  };

  const doChangePlan = async (tier: PaidTier) => {
    setChangeError(null);
    setChangingTier(tier);
    try {
      const res = await fetch("/api/subscription/change-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        setChangeError("Something went wrong starting checkout. Please try again.");
        setChangingTier(null);
        return;
      }
      const { checkout } = (await res.json()) as { checkout: CheckoutParams };
      const done = await startCheckout(checkout, async (r) => {
        const verifyRes = await fetch("/api/subscription/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(r),
        });
        if (!verifyRes.ok) {
          throw new Error("verify_failed");
        }
      });
      if (done) {
        router.refresh();
      } else {
        // User dismissed the checkout modal without paying — best-effort tell
        // the server right away (also resumes the old plan, which was paused
        // up front) instead of leaving this until startAt reconciliation.
        if (checkout.razorpay) {
          fetch("/api/subscription/abandon", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ providerSubscriptionId: checkout.razorpay.subscriptionId }),
          }).catch(() => {});
        }
        setChangingTier(null);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "verify_failed") {
        setChangeError(
          "Your payment may have gone through, but we couldn't confirm it. Please check your email or contact support before trying again.",
        );
      } else {
        setChangeError("Something went wrong starting checkout. Please try again.");
      }
      setChangingTier(null);
    }
  };

  const handleChangePlan = (tier: PaidTier) => {
    const target = paidPlans.find((p) => p.tier === tier);
    setConfirmDialog({
      title: t.manageSubscription.changePlanConfirmTitle,
      body: interpolate(t.manageSubscription.changePlanConfirmBody, {
        plan: target?.name ?? tier,
        date: view.currentEnd ? fmtDate(view.currentEnd) : "your next billing date",
      }),
      question: t.manageSubscription.confirmQuestion,
      onConfirm: () => doChangePlan(tier),
    });
  };

  const handleResume = async () => {
    setResumeError(null);
    setResuming(true);
    try {
      const res = await fetch("/api/subscription/resume", { method: "POST" });
      if (!res.ok) {
        setResumeError("Something went wrong. Please try again.");
        return;
      }
      setCancelled(false);
      setAccessUntil(null);
      // A resume can flip which top-level view the page shows (this
      // component vs. the FREE upgrade panel one level up, in
      // src/app/subscription/page.tsx) — router.refresh() re-fetches this
      // route's server data, but doesn't reliably re-run that parent
      // branch decision, so a resume could keep showing the FREE panel
      // until a real reload. Force one here instead of chasing that with
      // router.refresh().
      window.location.reload();
      return;
    } catch {
      setResumeError("Something went wrong. Please try again.");
    } finally {
      setResuming(false);
    }
  };

  const doCancelScheduledChange = async () => {
    setCancelScheduledError(null);
    setCancellingScheduled(true);
    try {
      const res = await fetch("/api/subscription/cancel-scheduled-change", { method: "POST" });
      if (!res.ok) {
        setCancelScheduledError("Something went wrong. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setCancelScheduledError("Something went wrong. Please try again.");
    } finally {
      setCancellingScheduled(false);
    }
  };

  const handleCancelScheduledChange = () => {
    setConfirmDialog({
      title: t.manageSubscription.cancelScheduledChangeConfirmTitle,
      body: interpolate(t.manageSubscription.cancelScheduledChangeConfirm, {
        plan: view.scheduledChange?.planName ?? "",
      }),
      question: t.manageSubscription.confirmQuestion,
      onConfirm: doCancelScheduledChange,
    });
  };

  const statusLine = (
    <div className="space-y-1">
      {view.status !== "active" && (
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-bold"
          style={{ background: "var(--ui-accent-bg)", color: "var(--ui-accent-warm)" }}
        >
          {statusLabel}
        </span>
      )}
      {view.nextChargeAt && !view.cancelAtCycleEnd && !view.scheduledChange && (
        <p
          className="inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-[0.78rem] font-bold"
          style={{ color: "var(--ui-accent-warm)", borderColor: "var(--ui-accent-warm)", background: "var(--ui-accent-bg)" }}
        >
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" style={{ background: "var(--ui-accent-warm)" }} aria-hidden />
          {interpolate(t.manageSubscription.nextCharge, { amount: view.amountPerCycle, date: fmtDate(view.nextChargeAt) })}
        </p>
      )}
      {effectiveAccessUntil && (
        <p className="font-semibold text-[color:var(--ui-text-pri)]">
          {interpolate(
            view.scheduledChange ? t.manageSubscription.activeUntilSwitch : t.manageSubscription.accessUntil,
            { date: fmtDate(effectiveAccessUntil) },
          )}
        </p>
      )}
    </div>
  );

  const actions = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {view.paymentRetrying && view.retryUrl && (
          <button
            onClick={() => window.open(view.retryUrl!, "_blank")}
            className="rounded-lg px-4 py-2 text-[0.78rem] font-bold"
            style={{ background: "var(--ui-accent-warm)", color: "var(--ui-on-accent)" }}
          >
            {t.manageSubscription.retryCta}
          </button>
        )}
        {view.scheduledChange ? (
          <button
            onClick={handleCancelScheduledChange}
            disabled={cancellingScheduled}
            className="rounded-lg border px-4 py-2 text-[0.78rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "var(--ui-card-border)", color: "var(--ui-text-sec)" }}
          >
            {t.manageSubscription.cancelScheduledChangeCta}
          </button>
        ) : alreadyCancelled ? (
          <button
            onClick={handleResume}
            disabled={resuming}
            className="rounded-lg px-4 py-2 text-[0.78rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--ui-accent-warm)", color: "var(--ui-on-accent)" }}
          >
            {t.manageSubscription.resumeCta}
          </button>
        ) : (
          <button
            onClick={handleCancel}
            disabled={cancelling || changingTier !== null}
            className="rounded-lg border px-4 py-2 text-[0.78rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "var(--ui-card-border)", color: "var(--ui-text-sec)" }}
          >
            {t.manageSubscription.cancelCta}
          </button>
        )}
      </div>
      {(cancelError || resumeError || cancelScheduledError) && (
        <p className="text-[0.72rem] font-semibold" style={{ color: "var(--ui-accent-warm)" }}>
          {cancelError ?? resumeError ?? cancelScheduledError}
        </p>
      )}
    </div>
  );

  const pendingCard = view.scheduledChange
    ? {
        tier: view.scheduledChange.tier,
        statusLine: (
          <p>
            {interpolate(t.manageSubscription.scheduledChangeBanner, {
              current: view.planName,
              plan: view.scheduledChange.planName,
              amount: view.scheduledChange.amountPerCycle,
              date: fmtDate(view.scheduledChange.startsAt),
            })}
          </p>
        ),
        footer: (
          <div
            className="w-full rounded-[10px] border-2 border-dashed py-[9px] text-center text-[0.78rem] font-extrabold"
            style={{ color: CURRENT_COLOR, borderColor: CURRENT_COLOR }}
          >
            {`Starts ${fmtDate(view.scheduledChange.startsAt)}`}
          </div>
        ),
      }
    : undefined;

  const failedCard = view.failedChange
    ? {
        tier: view.failedChange.tier,
        statusLine: (
          <p>
            {`Your last attempt to switch to ${view.failedChange.planName} didn't go through. You can try again.`}
          </p>
        ),
        footer: (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleChangePlan(view.failedChange!.tier);
            }}
            disabled={changingTier !== null}
            className="w-full rounded-[10px] border-2 py-[9px] text-center text-[0.78rem] font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: "var(--ui-accent-warm)", borderColor: "var(--ui-accent-warm)" }}
          >
            {changingTier === view.failedChange.tier ? "Starting…" : "Retry payment"}
          </button>
        ),
      }
    : undefined;

  return (
    <div className="space-y-4">
      {planCards.length > 0 && (
        <PaidTierPlanPicker
          plans={planCards}
          currentTier={view.tier as PaidTier}
          changingTier={changingTier}
          onSelectPaidTier={handleChangePlan}
          currentCardDetails={{ statusLine, actions }}
          disableNonCurrent={!!view.scheduledChange}
          pendingCard={pendingCard}
          failedCard={failedCard}
        />
      )}
      {changeError && (
        <p className="text-center text-[0.72rem] font-semibold" style={{ color: "var(--ui-accent-warm)" }}>
          {changeError}
        </p>
      )}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        body={confirmDialog?.body ?? ""}
        question={confirmDialog?.question}
        onCancel={() => setConfirmDialog(null)}
        onContinue={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
      />
    </div>
  );
}
