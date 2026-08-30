"use client";

import { useLocale } from "@/context/LocaleContext";

/**
 * Renders the FREE-tier heading on the Manage Subscription screen via
 * useLocale(), since the page itself is a server component and can't.
 */
export function FreeTierHeading() {
  const { t } = useLocale();

  return (
    <h2 className="mb-4 text-lg font-bold text-[color:var(--ui-text-pri)]">
      {t.manageSubscription.freeHeading}
    </h2>
  );
}
