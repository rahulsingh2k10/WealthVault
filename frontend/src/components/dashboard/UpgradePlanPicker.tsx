"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useLocale } from "@/context/LocaleContext";
import { BorderBeam } from "@/components/ui/border-beam";
import { formatMoney } from "@/lib/utils";
import { startCheckout } from "@/lib/payments/checkout";
import type { CheckoutParams } from "@/lib/payments/types";
import type { PaidTier, PlanCardView } from "@/lib/services/UpgradePromptService";

type Tier = PaidTier | "FREE";

interface UpgradePlanPickerProps {
  plans: PlanCardView[];
  memberCount: number | null;
  onSubscribed?: () => void;
  onClose?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  /** Marks this tier's card/tab "Current" (fixed blue accent, no buy button)
   *  and selects it by default. "FREE" also adds a non-purchasable Free
   *  tab/card ahead of the paid ones. Omitted on the dashboard's upgrade
   *  prompt, which never shows a current-plan indicator. */
  currentTier?: Tier;
  /** When set, clicking a non-current paid card calls this (a plan-change
   *  flow) instead of running this component's own checkout. Used on the
   *  subscription page for an already-paid user switching tiers. */
  onSelectPaidTier?: (tier: PaidTier) => void;
  /** Submitting state owned by the caller, shown/disabled the same way as
   *  this component's own checkout state. Only relevant with onSelectPaidTier. */
  externalSubmittingTier?: PaidTier | null;
  /** Replaces the current card's tagline and footer with live account
   *  status/actions (e.g. price-locked date, cancel/resume, retry payment),
   *  instead of the default static "Current plan" label. Paid-tier only. */
  currentCardDetails?: { statusLine: React.ReactNode; actions: React.ReactNode };
  /** Disables every non-current tab/card (button, click-to-select, keyboard
   *  selection) — used when a plan change is already scheduled and another
   *  can't be queued until it takes effect. */
  disableNonCurrent?: boolean;
  /** Marks the tier a scheduled change is switching to: shows `statusLine`
   *  in place of its tagline and `footer` in place of its buy button, with
   *  a dashed blue "upcoming" treatment distinct from the current card. */
  pendingCard?: { tier: PaidTier; statusLine: React.ReactNode; footer: React.ReactNode };
  /** Marks the tier a plan-change attempt failed/was abandoned on: shows
   *  `statusLine` and `footer` (typically a retry action) in place of the
   *  tagline/buy button, with a warm "payment failed" treatment distinct
   *  from both the current card and a genuinely scheduled one. */
  failedCard?: { tier: PaidTier; statusLine: React.ReactNode; footer: React.ReactNode };
}

const PLAN_NAME: Record<Tier, string> = {
  FREE: "Free",
  MONTHLY: "Reserve",
  QUARTERLY: "Treasury",
  ANNUAL: "Sovereign",
};
const PLAN_GEM: Record<Tier, string> = { FREE: "🌱", MONTHLY: "🪙", QUARTERLY: "💎", ANNUAL: "👑" };

/** Fixed accent for the current-plan card — distinct from the gold/purple
 *  "selected to buy" accent, so "this is what you have" never reads as
 *  "this is what you're about to purchase". */
export const CURRENT_COLOR = "#3B82F6";

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/**
 * The hero + plan-selection + checkout content shared by the dashboard's
 * UpgradeModal (rendered inside an overlay dialog) and the subscription
 * page (rendered inline). Owns plan selection and checkout; callers own
 * the surrounding chrome (dialog vs. inline card) and positioning.
 */
export function UpgradePlanPicker({
  plans,
  memberCount,
  onSubscribed,
  onClose,
  onSubmittingChange,
  currentTier,
  onSelectPaidTier,
  externalSubmittingTier,
  currentCardDetails,
  disableNonCurrent,
  pendingCard,
  failedCard,
}: UpgradePlanPickerProps) {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [submittingTier, setSubmittingTier] = useState<PaidTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const showFreeTab = currentTier === "FREE";
  const activeSubmitting = onSelectPaidTier ? externalSubmittingTier ?? null : submittingTier;

  // Default selection: the current plan when known, else ANNUAL if present,
  // else the plan with the most billing months.
  const defaultTier: Tier =
    currentTier ??
    plans.find((p) => p.tier === "ANNUAL")?.tier ??
    [...plans].sort((a, b) => b.billingMonths - a.billingMonths)[0]?.tier ??
    "ANNUAL";
  const [selected, setSelected] = useState<Tier>(failedCard?.tier ?? defaultTier);
  const radioRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isFirstRender = useRef(true);

  // Re-sync the selection whenever the account's actual plan state changes
  // underneath (a change-plan flow completes, or a scheduled change is
  // cancelled) — otherwise a tab explored earlier keeps its "selected"
  // border/animation even after it's no longer current or pending.
  useEffect(() => {
    if (currentTier) setSelected(pendingCard?.tier ?? failedCard?.tier ?? currentTier);
  }, [currentTier, pendingCard?.tier, failedCard?.tier]);

  // Below the cards' grid breakpoint they stack vertically, so picking a tab
  // can select a card that's scrolled out of view — bring it on screen.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    cardRefs.current[selected]?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [selected, reduceMotion]);

  const tierOrder: Tier[] = showFreeTab ? ["FREE", ...plans.map((p) => p.tier)] : plans.map((p) => p.tier);
  const isTierDisabled = (tier: Tier) => !!disableNonCurrent && tier !== currentTier;
  const selectableTierOrder = tierOrder.filter((t) => !isTierDisabled(t));
  const moveSelection = (delta: number) => {
    const i = selectableTierOrder.indexOf(selected);
    if (i === -1) return;
    const next = selectableTierOrder[(i + delta + selectableTierOrder.length) % selectableTierOrder.length];
    setSelected(next);
    radioRefs.current[next]?.focus();
  };
  const onRadioKeyDown = (tier: Tier) => (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (isTierDisabled(tier)) return; setSelected(tier); radioRefs.current[tier]?.focus(); }
  };

  const anyOffer = plans.some((p) => p.offerActive);
  const bannerPlan = plans.filter((p) => p.offerActive).sort((a, b) => b.discountPercent - a.discountPercent)[0];
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));

  const perMonth = (p: PlanCardView, amount: number) =>
    formatMoney(Math.round(amount / p.billingMonths), p.currency, locale);
  const billedLabel = (p: PlanCardView) => {
    const amount = formatMoney(p.effectivePerPeriod, p.currency, locale);
    const key = p.billingMonths === 1 ? "everyMonth" : p.billingMonths === 3 ? "everyQuarter" : "everyYear";
    return interpolate(t.upgrade[key], { amount });
  };
  const billedCadence = (p: PlanCardView) =>
    p.billingMonths === 1 ? t.upgrade.billedMonthly : p.billingMonths === 3 ? t.upgrade.billedQuarterly : t.upgrade.billedYearly;
  const tagline = (p: PlanCardView) =>
    p.tier === "MONTHLY" ? t.upgrade.reserveTagline : p.tier === "QUARTERLY" ? t.upgrade.treasuryTagline : t.upgrade.sovereignTagline;
  const cta = (p: PlanCardView) =>
    p.tier === "MONTHLY" ? t.upgrade.ctaReserve : p.tier === "QUARTERLY" ? t.upgrade.ctaTreasury : t.upgrade.ctaSovereign;

  const accentStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, var(--ui-accent), var(--ui-accent-warm))",
  };

  const handleCheckout = async (p: PlanCardView) => {
    setCheckoutError(null);
    setSubmittingTier(p.tier);
    onSubmittingChange?.(true);
    try {
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier: p.tier }),
      });
      if (!res.ok) {
        setCheckoutError("Something went wrong starting checkout. Please try again.");
        setSubmittingTier(null);
        onSubmittingChange?.(false);
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
        onSubmittingChange?.(false);
        onClose?.();
        onSubscribed?.();
      } else {
        setSubmittingTier(null);
        onSubmittingChange?.(false);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "verify_failed") {
        setCheckoutError(
          "Your payment may have gone through, but we couldn't confirm it. Please check your email or contact support before trying again.",
        );
      } else {
        setCheckoutError("Something went wrong starting checkout. Please try again.");
      }
      setSubmittingTier(null);
      onSubmittingChange?.(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <div
        className="px-6 pb-5 pt-7 sm:px-8"
        style={{
          background: "radial-gradient(120% 140% at 12% 0%, var(--ui-accent-bg), transparent 55%)",
        }}
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px]"
          style={{ ...accentStyle, color: "var(--ui-on-accent)", boxShadow: "0 8px 24px -6px var(--ui-accent)" }}
        >
          🏛️
        </div>
        <h2 id="upgrade-modal-title" className="mt-4 text-[1.35rem] font-bold tracking-tight text-[color:var(--ui-text-pri)]">
          {t.upgrade.title}
        </h2>
        <p className="mt-1.5 max-w-[46ch] text-[0.8rem] text-[color:var(--ui-text-sec)]">
          {t.upgrade.subtitle}
        </p>
        {memberCount !== null && (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] text-[color:var(--ui-text-sec)]"
            style={{ borderColor: "var(--ui-card-border)", background: "var(--ui-modal-bg)" }}
          >
            {interpolate(t.upgrade.social, {
              count: new Intl.NumberFormat(locale).format(memberCount),
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 pb-4 pt-6 sm:px-8">
        {anyOffer && bannerPlan?.offerEndsAt && (
          <div
            className="mb-5 flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-[0.72rem] font-bold"
            style={{
              color: "var(--ui-accent-warm)",
              borderColor: "var(--ui-accent-warm)",
              background: "var(--ui-accent-bg)",
            }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: "var(--ui-accent-warm)" }}
            />
            {interpolate(t.upgrade.offerBanner, {
              percent: bannerPlan.discountPercent,
              date: fmtDate(bannerPlan.offerEndsAt),
            })}
          </div>
        )}

        {/* Segmented control — the accessible plan selector */}
        <div
          className="mb-5 flex gap-1 rounded-xl border p-1"
          style={{ borderColor: "var(--ui-card-border)", background: "var(--ui-subtle-bg)" }}
          role="radiogroup"
          aria-label="Choose a billing plan"
        >
          {tierOrder.map((tier) => {
            const p = tier === "FREE" ? null : plans.find((pl) => pl.tier === tier)!;
            const tierDisabled = isTierDisabled(tier);
            return (
              <button
                key={tier}
                ref={(el) => { radioRefs.current[tier] = el; }}
                role="radio"
                aria-checked={selected === tier}
                tabIndex={selected === tier ? 0 : -1}
                disabled={tierDisabled}
                onClick={() => setSelected(tier)}
                onKeyDown={onRadioKeyDown(tier)}
                className="flex-1 rounded-lg px-2 py-2 text-[0.78rem] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={
                  selected === tier
                    ? {
                        background: "var(--ui-modal-bg)",
                        color: "var(--ui-text-pri)",
                        boxShadow: "0 0 0 1.5px var(--ui-accent-border), 0 4px 14px -2px var(--ui-accent)",
                      }
                    : { color: "var(--ui-text-sec)" }
                }
              >
                {PLAN_NAME[tier]}
                <span
                  className="mt-0.5 block text-[0.62rem]"
                  style={{ color: p === null ? "var(--ui-text-muted)" : "var(--ui-accent-warm)" }}
                >
                  {p === null
                    ? "Current"
                    : p.tier === "ANNUAL"
                      ? t.upgrade.chipBestValue
                      : p.offerActive
                        ? interpolate(t.upgrade.chipSave, { percent: p.discountPercent })
                        : " "}
                </span>
              </button>
            );
          })}
        </div>

        {/* Plan cards */}
        <div className={`grid gap-4 ${showFreeTab ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {showFreeTab && (
            <div
              ref={(el) => { cardRefs.current.FREE = el; }}
              onClick={() => setSelected("FREE")}
              className="relative cursor-pointer rounded-2xl border-2 p-4 sm:p-[18px]"
              style={{
                borderColor: CURRENT_COLOR,
                background: `linear-gradient(180deg, ${CURRENT_COLOR}1a, transparent 55%), var(--ui-modal-bg)`,
              }}
            >
              {selected === "FREE" && !reduceMotion && (
                <BorderBeam colorFrom={CURRENT_COLOR} colorTo={CURRENT_COLOR} borderWidth={2} duration={6} />
              )}
              <div className="mb-3 flex min-h-[22px] items-center gap-2">
                <span className="text-[17px] leading-none">{PLAN_GEM.FREE}</span>
                <span
                  className="rounded-full px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                  style={{ color: "#fff", background: CURRENT_COLOR }}
                >
                  CURRENT
                </span>
                {selected === "FREE" && (
                  <span
                    className="ml-auto flex h-[21px] w-[21px] items-center justify-center rounded-full text-[12px]"
                    style={{ background: CURRENT_COLOR, color: "#fff" }}
                    aria-hidden
                  >
                    ✓
                  </span>
                )}
              </div>

              <div className="mb-1 flex items-start justify-between gap-4 sm:block">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.95rem] font-extrabold text-[color:var(--ui-text-pri)]">Free</div>
                  <div className="mt-0.5 text-[0.72rem] text-[color:var(--ui-text-muted)]">Your plan today</div>
                  <div className="mt-1.5 min-h-0 text-[0.72rem] leading-normal text-[color:var(--ui-text-sec)] sm:mt-3 sm:min-h-[34px]">
                    Core tracking with limited assets &amp; exports.
                  </div>
                </div>
                <div className="shrink-0 text-right sm:text-left">
                  <div className="min-h-[14px] text-[0.7rem] text-[color:var(--ui-text-muted)] sm:mt-3.5">&nbsp;</div>
                  <div className="mt-0.5 whitespace-nowrap text-[1.6rem] font-black leading-none tracking-tight text-[color:var(--ui-text-pri)] sm:text-[1.7rem]">
                    {formatMoney(0, plans[0]?.currency ?? "INR", locale)}
                  </div>
                  <div className="mt-1 text-[0.66rem] text-[color:var(--ui-text-muted)]">Forever</div>
                </div>
              </div>

              <div
                className="mt-4 w-full rounded-[10px] border-[1.5px] py-[9px] text-center text-[0.78rem] font-extrabold"
                style={{ color: CURRENT_COLOR, borderColor: CURRENT_COLOR }}
              >
                Current plan
              </div>
            </div>
          )}
          {plans.map((p) => {
            const isSelected = selected === p.tier;
            const isCurrent = p.tier === currentTier;
            const isPending = pendingCard?.tier === p.tier;
            const isFailed = failedCard?.tier === p.tier;
            const tierDisabled = isTierDisabled(p.tier);
            return (
              <div
                key={p.tier}
                ref={(el) => { cardRefs.current[p.tier] = el; }}
                onClick={() => { if (tierDisabled) return; setSelected(p.tier); }}
                className={`relative rounded-2xl p-4 sm:p-[18px] ${isCurrent || isPending || isFailed ? "border-2" : "border"} ${isPending || isFailed ? "border-dashed" : ""} ${tierDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                style={
                  isCurrent
                    ? { borderColor: CURRENT_COLOR, background: `linear-gradient(180deg, ${CURRENT_COLOR}1a, transparent 55%), var(--ui-modal-bg)` }
                    : isPending
                      ? { borderColor: CURRENT_COLOR, background: `linear-gradient(180deg, ${CURRENT_COLOR}0d, transparent 55%), var(--ui-modal-bg)` }
                      : isFailed
                        ? { borderColor: "var(--ui-accent-warm)", background: "linear-gradient(180deg, var(--ui-accent-bg), transparent 55%), var(--ui-modal-bg)" }
                        : {
                            borderColor: isSelected ? "var(--ui-accent-border)" : "var(--ui-card-border)",
                            background: isSelected
                              ? "linear-gradient(180deg, var(--ui-accent-bg), transparent 55%), var(--ui-modal-bg)"
                              : "var(--ui-modal-bg)",
                            boxShadow: isSelected ? "0 22px 55px -22px var(--ui-accent)" : undefined,
                          }
                }
              >
                {isSelected && !tierDisabled && !isFailed && !reduceMotion && (
                  <BorderBeam
                    colorFrom={isCurrent ? CURRENT_COLOR : "var(--ui-accent)"}
                    colorTo={isCurrent ? CURRENT_COLOR : "var(--ui-accent-warm)"}
                    borderWidth={2}
                    duration={6}
                  />
                )}

                {/* top row: gem + chip (left), check (right) */}
                <div className="mb-3 flex min-h-[22px] items-center gap-2">
                  <span className="text-[17px] leading-none">{PLAN_GEM[p.tier]}</span>
                  {isCurrent ? (
                    <span
                      className="rounded-full px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                      style={{ color: "#fff", background: CURRENT_COLOR }}
                    >
                      CURRENT
                    </span>
                  ) : isPending ? (
                    <span
                      className="rounded-full border px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                      style={{ color: CURRENT_COLOR, borderColor: CURRENT_COLOR, background: "transparent" }}
                    >
                      UPCOMING
                    </span>
                  ) : isFailed ? (
                    <span
                      className="rounded-full border px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                      style={{ color: "var(--ui-accent-warm)", borderColor: "var(--ui-accent-warm)", background: "transparent" }}
                    >
                      PAYMENT FAILED
                    </span>
                  ) : p.tier === "ANNUAL" ? (
                    <span
                      className="rounded-full px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                      style={{ ...accentStyle, color: "var(--ui-on-accent)" }}
                    >
                      {t.upgrade.chipBestValue}
                    </span>
                  ) : p.offerActive ? (
                    <span
                      className="rounded-full border px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                      style={{
                        color: "var(--ui-accent-warm)",
                        borderColor: "var(--ui-accent-warm)",
                        background: "var(--ui-accent-bg)",
                      }}
                    >
                      {interpolate(t.upgrade.chipSave, { percent: p.discountPercent })}
                    </span>
                  ) : null}
                  {isSelected && (
                    <span
                      className="ml-auto flex h-[21px] w-[21px] items-center justify-center rounded-full text-[12px]"
                      style={{
                        background: isCurrent ? CURRENT_COLOR : isFailed ? "var(--ui-accent-warm)" : "var(--ui-accent)",
                        color: isCurrent ? "#fff" : "var(--ui-on-accent)",
                      }}
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                </div>

                {/* mid: identity + price (row on mobile) */}
                <div className="mb-1 flex items-start justify-between gap-4 sm:block">
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.95rem] font-extrabold text-[color:var(--ui-text-pri)]">
                      {PLAN_NAME[p.tier]}
                    </div>
                    <div className="mt-0.5 text-[0.72rem] text-[color:var(--ui-text-muted)]">
                      {billedCadence(p)}
                    </div>
                    <div className="mt-1.5 min-h-0 text-[0.72rem] leading-normal text-[color:var(--ui-text-sec)] sm:mt-3 sm:min-h-[34px]">
                      {isCurrent && currentCardDetails
                        ? currentCardDetails.statusLine
                        : isPending
                          ? pendingCard!.statusLine
                          : isFailed
                            ? failedCard!.statusLine
                            : tagline(p)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right sm:text-left">
                    <div className="min-h-[14px] text-[0.7rem] text-[color:var(--ui-text-muted)] line-through sm:mt-3.5">
                      {p.offerActive
                        ? `${perMonth(p, p.basePerPeriod)}${t.upgrade.perMonthSuffix}`
                        : " "}
                    </div>
                    <div className="mt-0.5 whitespace-nowrap text-[1.6rem] font-black leading-none tracking-tight text-[color:var(--ui-text-pri)] sm:text-[1.7rem]">
                      {perMonth(p, p.effectivePerPeriod)}
                      <span className="text-[0.7rem] font-semibold text-[color:var(--ui-text-muted)]">
                        {" "}
                        {t.upgrade.perMonthSuffix}
                      </span>
                    </div>
                    <div className="mt-1 text-[0.66rem] text-[color:var(--ui-text-muted)]">
                      {billedLabel(p)}
                    </div>
                  </div>
                </div>

                {p.offerActive && p.offerEndsAt && (
                  <div className="mt-3 text-[0.62rem] font-extrabold" style={{ color: "var(--ui-accent-warm)" }}>
                    {interpolate(t.upgrade.offerCaption, {
                      percent: p.discountPercent,
                      date: fmtDate(p.offerEndsAt),
                    })}
                  </div>
                )}

                {isCurrent ? (
                  currentCardDetails ? (
                    <div className="mt-4">{currentCardDetails.actions}</div>
                  ) : (
                    <div
                      className="mt-4 w-full rounded-[10px] border-[1.5px] py-[9px] text-center text-[0.78rem] font-extrabold"
                      style={{ color: CURRENT_COLOR, borderColor: CURRENT_COLOR }}
                    >
                      Current plan
                    </div>
                  )
                ) : isPending ? (
                  <div className="mt-4">{pendingCard!.footer}</div>
                ) : isFailed ? (
                  <div className="mt-4">{failedCard!.footer}</div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectPaidTier) onSelectPaidTier(p.tier);
                      else void handleCheckout(p);
                    }}
                    disabled={activeSubmitting !== null || tierDisabled}
                    className="mt-4 w-full rounded-[10px] border-[1.5px] py-[9px] text-[0.78rem] font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
                    style={
                      isSelected
                        ? { ...accentStyle, color: "var(--ui-on-accent)", borderColor: "transparent" }
                        : { color: "var(--ui-accent)", borderColor: "var(--ui-accent-border)", background: "transparent" }
                    }
                  >
                    {activeSubmitting === p.tier ? "Starting…" : cta(p)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {checkoutError && (
          <div className="mt-3 text-center text-[0.72rem] font-bold" style={{ color: "var(--ui-accent-warm)" }}>
            {checkoutError}
          </div>
        )}

        {/* Features */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {[t.upgrade.feature1, t.upgrade.feature2, t.upgrade.feature3, t.upgrade.feature4].map((f) => (
            <div key={f} className="text-[0.78rem] text-[color:var(--ui-text-pri)]">
              <span className="mr-2 font-extrabold" style={{ color: "var(--ui-accent-warm)" }} aria-hidden>
                ✓
              </span>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Trust */}
      <div className="flex flex-wrap items-center justify-center gap-4 px-6 pb-6 pt-4 text-[0.72rem] text-[color:var(--ui-text-muted)] sm:px-8">
        <span><span aria-hidden>🔒 </span>{t.upgrade.trustEncrypted}</span>
        <span><span aria-hidden>↩︎ </span>{t.upgrade.trustCancel}</span>
      </div>
    </>
  );
}
