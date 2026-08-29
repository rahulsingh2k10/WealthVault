"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { BorderBeam } from "@/components/ui/border-beam";
import { formatMoney } from "@/lib/utils";
import type { PaidTier, PlanCardView } from "@/lib/services/UpgradePromptService";

interface UpgradeModalProps {
  open: boolean;
  plans: PlanCardView[];
  memberCount: number | null;
  onClose: () => void;
}

const PLAN_NAME: Record<PaidTier, string> = {
  MONTHLY: "Reserve",
  QUARTERLY: "Treasury",
  ANNUAL: "Sovereign",
};
const PLAN_GEM: Record<PaidTier, string> = { MONTHLY: "🪙", QUARTERLY: "💎", ANNUAL: "👑" };

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function UpgradeModal({ open, plans, memberCount, onClose }: UpgradeModalProps) {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Default selection: ANNUAL if present, else the plan with the most billing months.
  const defaultTier =
    plans.find((p) => p.tier === "ANNUAL")?.tier ??
    [...plans].sort((a, b) => b.billingMonths - a.billingMonths)[0]?.tier ??
    "ANNUAL";
  const [selected, setSelected] = useState<PaidTier>(defaultTier);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

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

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="upgrade-backdrop"
            className="fixed inset-0 z-40 backdrop-blur-[3px]"
            style={{ background: "rgba(20,10,40,0.45)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35 }}
            onClick={onClose}
          />
          <motion.div
            key="upgrade-panel"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none sm:p-6"
            initial={{ opacity: 0, y: 14, scale: reduceMotion ? 1 : 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: reduceMotion ? 1 : 0.94 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrade-modal-title"
              className="pointer-events-auto relative flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl"
              style={{
                maxHeight: "calc(100dvh - 3rem)",
                background: "var(--ui-modal-bg)",
                boxShadow: "var(--ui-modal-shadow)",
              }}
            >
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--ui-text-muted)] hover:text-[color:var(--ui-text-sec)]"
                style={{ background: "var(--ui-subtle-bg)" }}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Hero */}
                <div
                  className="px-6 pb-5 pt-7 sm:px-8"
                  style={{
                    background:
                      "radial-gradient(120% 140% at 12% 0%, var(--ui-accent-bg), transparent 55%)",
                  }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px]"
                    style={{ ...accentStyle, color: "#fff", boxShadow: "0 8px 24px -6px var(--ui-accent)" }}
                  >
                    🏛️
                  </div>
                  <h2
                    id="upgrade-modal-title"
                    className="mt-4 text-[1.35rem] font-bold tracking-tight text-[color:var(--ui-text-pri)]"
                  >
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
                      className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.72rem] font-bold"
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

                  {/* Segmented control — sm and up only */}
                  <div
                    className="mb-5 hidden gap-1 rounded-xl border p-1 sm:flex"
                    style={{ borderColor: "var(--ui-card-border)", background: "var(--ui-subtle-bg)" }}
                    role="tablist"
                    aria-label="Choose a plan"
                  >
                    {plans.map((p) => (
                      <button
                        key={p.tier}
                        role="tab"
                        aria-selected={selected === p.tier}
                        onClick={() => setSelected(p.tier)}
                        className="flex-1 rounded-lg px-2 py-2 text-[0.78rem] font-bold"
                        style={
                          selected === p.tier
                            ? { background: "var(--ui-modal-bg)", color: "var(--ui-text-pri)", boxShadow: "0 1px 4px rgba(15,23,42,0.12)" }
                            : { color: "var(--ui-text-sec)" }
                        }
                      >
                        {PLAN_NAME[p.tier]}
                        <span
                          className="mt-0.5 block text-[0.62rem]"
                          style={{ color: "var(--ui-accent-warm)" }}
                        >
                          {p.tier === "ANNUAL"
                            ? t.upgrade.chipBestValue
                            : p.offerActive
                              ? interpolate(t.upgrade.chipSave, { percent: p.discountPercent })
                              : " "}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Plan cards */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {plans.map((p) => {
                      const isSelected = selected === p.tier;
                      return (
                        <div
                          key={p.tier}
                          onClick={() => setSelected(p.tier)}
                          className="relative cursor-pointer rounded-2xl border p-4 sm:p-[18px]"
                          style={{
                            borderColor: isSelected ? "var(--ui-accent-border)" : "var(--ui-card-border)",
                            background: isSelected
                              ? "linear-gradient(180deg, var(--ui-accent-bg), transparent 55%), var(--ui-modal-bg)"
                              : "var(--ui-modal-bg)",
                            boxShadow: isSelected ? "0 22px 55px -22px var(--ui-accent)" : undefined,
                          }}
                        >
                          {isSelected && !reduceMotion && (
                            <BorderBeam
                              colorFrom="var(--ui-accent)"
                              colorTo="var(--ui-accent-warm)"
                              borderWidth={2}
                              duration={6}
                            />
                          )}

                          {/* top row: gem + chip (left), check (right) */}
                          <div className="mb-3 flex min-h-[22px] items-center gap-2">
                            <span className="text-[17px] leading-none">{PLAN_GEM[p.tier]}</span>
                            {p.tier === "ANNUAL" ? (
                              <span
                                className="rounded-full px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                                style={{ ...accentStyle, color: "#fff" }}
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
                                className="ml-auto flex h-[21px] w-[21px] items-center justify-center rounded-full text-[12px] text-white"
                                style={{ background: "var(--ui-accent)" }}
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
                                {tagline(p)}
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

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Presentational — future analytics hook.
                              console.info("[upgrade-prompt] plan CTA:", p.tier);
                              onClose();
                            }}
                            className="mt-4 w-full rounded-[10px] border-[1.5px] py-[9px] text-[0.78rem] font-extrabold"
                            style={
                              isSelected
                                ? { ...accentStyle, color: "#fff", borderColor: "transparent" }
                                : { color: "var(--ui-accent)", borderColor: "var(--ui-accent-border)", background: "transparent" }
                            }
                          >
                            {cta(p)}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Features */}
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {[t.upgrade.feature1, t.upgrade.feature2, t.upgrade.feature3, t.upgrade.feature4].map((f) => (
                      <div key={f} className="text-[0.78rem] text-[color:var(--ui-text-pri)]">
                        <span className="mr-2 font-extrabold" style={{ color: "var(--ui-accent-warm)" }}>
                          ✓
                        </span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust + Maybe later */}
                <div className="flex flex-wrap items-center justify-center gap-4 px-6 pb-1 pt-4 text-[0.72rem] text-[color:var(--ui-text-muted)] sm:px-8">
                  <span>🔒 {t.upgrade.trustEncrypted}</span>
                  <span>↩︎ {t.upgrade.trustCancel}</span>
                  <span>✦ {t.upgrade.trustMoneyBack}</span>
                </div>
                <button
                  onClick={onClose}
                  className="mx-auto mb-6 mt-2 block text-[0.78rem] text-[color:var(--ui-text-muted)] underline"
                >
                  {t.upgrade.maybeLater}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
