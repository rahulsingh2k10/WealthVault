"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";

const DISMISS_KEY = "wv:renewal-banner:dismissed";

/**
 * Mounts invisibly inside authenticated pages. Fetches /api/auth/me and, if
 * the user has a payment currently retrying, renders a dismissible bar
 * pointing to /subscription. Dismissal is remembered for the rest of the
 * browser session (sessionStorage), same pattern as UpgradePrompt.
 */
export function RenewalBanner() {
  const { t } = useLocale();
  const [paymentRetrying, setPaymentRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.user?.paymentRetrying) setPaymentRetrying(true); })
      .catch(() => {});

    try {
      if (sessionStorage.getItem(DISMISS_KEY)) setDismissed(true);
    } catch {
      // sessionStorage unavailable (privacy mode) — just proceed to show it.
    }
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  if (!paymentRetrying || dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 border-b px-6 py-2.5 text-[0.8rem]"
      style={{
        background: "var(--ui-accent-bg)",
        borderColor: "var(--ui-accent-warm)",
        color: "var(--ui-accent-warm)",
      }}
    >
      <span className="flex-1 font-semibold">{t.renewalBanner.message}</span>
      <Link href="/subscription" className="shrink-0 font-bold underline">
        {t.renewalBanner.action}
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:opacity-70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
