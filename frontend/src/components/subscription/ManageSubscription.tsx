"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { Card } from "@/components/ui/Card";
import { startCheckout } from "@/lib/payments/checkout";
import type { CheckoutParams } from "@/lib/payments/types";
import type { buildManageView, PaidPlanOption } from "@/lib/services/SubscriptionService";

type ManageView = Exclude<Awaited<ReturnType<typeof buildManageView>>, { tier: "FREE" }>;

interface ManageSubscriptionProps {
  view: ManageView;
  paidPlans: PaidPlanOption[];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function ManageSubscription({ view, paidPlans }: ManageSubscriptionProps) {
  const { t, locale } = useLocale();
  const router = useRouter();

  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [accessUntil, setAccessUntil] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [changingTier, setChangingTier] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  const [cancellingScheduled, setCancellingScheduled] = useState(false);
  const [cancelScheduledError, setCancelScheduledError] = useState<string | null>(null);

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

  const handleCancel = async () => {
    const body = view.currentEnd
      ? interpolate(t.manageSubscription.cancelConfirmBody, { plan: view.planName, date: fmtDate(view.currentEnd) })
      : t.manageSubscription.cancelConfirmTitle;
    if (!window.confirm(body)) return;

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

  const handleChangePlan = async (tier: string) => {
    const target = paidPlans.find((p) => p.tier === tier);
    const ok = window.confirm(
      interpolate(t.manageSubscription.changePlanConfirmBody, {
        plan: target?.name ?? tier,
        date: view.currentEnd ? fmtDate(view.currentEnd) : "your next billing date",
      }),
    );
    if (!ok) return;

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

  const handleCancelScheduledChange = async () => {
    const ok = window.confirm(
      interpolate(t.manageSubscription.cancelScheduledChangeConfirm, {
        plan: view.scheduledChange?.planName ?? "",
      }),
    );
    if (!ok) return;
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

  const otherPlans = paidPlans.filter((p) => p.tier !== view.tier);

  return (
    <div className="max-w-xl space-y-4">
      {view.scheduledChange && (
        <Card>
          <p className="text-[0.82rem] font-semibold text-[color:var(--ui-text-pri)]">
            {interpolate(t.manageSubscription.scheduledChangeBanner, {
              current: view.planName,
              plan: view.scheduledChange.planName,
              amount: view.scheduledChange.amountPerCycle,
              date: fmtDate(view.scheduledChange.startsAt),
            })}
          </p>
        </Card>
      )}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[color:var(--ui-text-pri)]">{view.planName}</h2>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
              style={{ background: "var(--ui-accent-bg)", color: "var(--ui-accent-warm)" }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-[0.82rem] text-[color:var(--ui-text-sec)]">
          {view.nextChargeAt && !view.cancelAtCycleEnd && (
            <p>{interpolate(t.manageSubscription.nextCharge, { amount: view.amountPerCycle, date: fmtDate(view.nextChargeAt) })}</p>
          )}
          <p>{interpolate(t.manageSubscription.priceLocked, { date: fmtDate(view.priceLockedThrough) })}</p>
          {effectiveAccessUntil && (
            <p className="font-semibold text-[color:var(--ui-text-pri)]">
              {interpolate(
                view.scheduledChange ? t.manageSubscription.activeUntilSwitch : t.manageSubscription.accessUntil,
                { date: fmtDate(effectiveAccessUntil) },
              )}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {view.paymentRetrying && view.retryUrl && (
            <button
              onClick={() => window.open(view.retryUrl!, "_blank")}
              className="rounded-lg px-4 py-2 text-[0.78rem] font-bold"
              style={{ background: "var(--ui-accent-warm)", color: "var(--ui-on-accent)" }}
            >
              {t.manageSubscription.retryCta}
            </button>
          )}
          <button
            onClick={handleCancel}
            disabled={cancelling || alreadyCancelled || changingTier !== null}
            className="rounded-lg border px-4 py-2 text-[0.78rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "var(--ui-card-border)", color: "var(--ui-text-sec)" }}
          >
            {t.manageSubscription.cancelCta}
          </button>
        </div>

        {cancelError && (
          <p className="mt-3 text-[0.72rem] font-semibold" style={{ color: "var(--ui-accent-warm)" }}>
            {cancelError}
          </p>
        )}
      </Card>

      {otherPlans.length > 0 && (
        <Card>
          <h3 className="mb-3 text-[0.78rem] font-bold uppercase tracking-wide text-[color:var(--ui-text-muted)]">
            {t.manageSubscription.changePlanCta}
          </h3>
          {view.scheduledChange ? (
            <div className="space-y-3">
              <p className="text-[0.82rem] text-[color:var(--ui-text-muted)]">{t.manageSubscription.scheduledChangeNote}</p>
              <button
                onClick={handleCancelScheduledChange}
                disabled={cancellingScheduled}
                className="rounded-lg border px-4 py-2 text-[0.78rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: "var(--ui-card-border)", color: "var(--ui-text-sec)" }}
              >
                {t.manageSubscription.cancelScheduledChangeCta}
              </button>
              {cancelScheduledError && (
                <p className="text-[0.72rem] font-semibold" style={{ color: "var(--ui-accent-warm)" }}>{cancelScheduledError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {otherPlans.map((p) => (
                <button
                  key={p.tier}
                  onClick={() => handleChangePlan(p.tier)}
                  disabled={changingTier !== null || cancelling}
                  className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-[0.82rem] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: "var(--ui-card-border)" }}
                >
                  <span className="font-bold text-[color:var(--ui-text-pri)]">{p.name}</span>
                  <span className="text-[color:var(--ui-text-muted)]">
                    {changingTier === p.tier ? "Starting…" : `${p.perMonth}/mo · ${p.perCycle}`}
                  </span>
                </button>
              ))}
            </div>
          )}
          {changeError && (
            <p className="mt-3 text-[0.72rem] font-semibold" style={{ color: "var(--ui-accent-warm)" }}>
              {changeError}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
