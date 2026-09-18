"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { ICON_MAP, type NavItemDto } from "@/i18n/navConfig";
import { MenuBar } from "@/components/ui/glow-menu";

interface CategoryStyle {
  iconColor: string; // Tailwind class — must appear literally here for JIT to generate it
  rgb: string;        // same color as "r,g,b", for the glow gradient
}

/**
 * One fixed hue per category, keyed by iconName (stable across countries).
 * Deliberately avoids the hues already used by the account cluster in
 * Sidebar.tsx (orange, slate, pink, red) so the two floating nav pieces
 * don't accidentally read as related to each other.
 */
const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  LayoutDashboard:  { iconColor: "text-violet-500",  rgb: "139,92,246" },
  CandlestickChart: { iconColor: "text-blue-600",     rgb: "37,99,235" },
  BarChart3:        { iconColor: "text-cyan-600",     rgb: "8,145,178" },
  Gem:              { iconColor: "text-amber-600",    rgb: "217,119,6" },
  Home:             { iconColor: "text-yellow-800",   rgb: "133,77,14" },
  Bitcoin:          { iconColor: "text-indigo-600",   rgb: "79,70,229" },
  Shield:           { iconColor: "text-teal-600",     rgb: "13,148,136" },
  Wallet:           { iconColor: "text-emerald-600",  rgb: "5,150,105" },
  HandCoins:        { iconColor: "text-fuchsia-600",  rgb: "192,38,211" },
  Vault:            { iconColor: "text-sky-600",      rgb: "2,132,199" },
  Landmark:         { iconColor: "text-purple-600",   rgb: "126,34,206" },
};
const FALLBACK_STYLE: CategoryStyle = { iconColor: "text-slate-500", rgb: "100,116,139" };

function glowGradient(rgb: string): string {
  return `radial-gradient(circle, rgba(${rgb},0.18) 0%, rgba(${rgb},0.06) 50%, rgba(${rgb},0) 100%)`;
}

export function CategoryMenuBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, country } = useLocale();

  const [navItems, setNavItems] = useState<NavItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/nav?country=${encodeURIComponent(country)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NavItemDto[]) => setNavItems(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [country]);

  const items = navItems.map((item) => {
    const style = CATEGORY_STYLE[item.iconName] ?? FALLBACK_STYLE;
    return {
      icon: ICON_MAP[item.iconName] ?? (() => null),
      label: t.nav[item.labelKey as keyof typeof t.nav] ?? item.labelKey,
      href: item.href,
      gradient: glowGradient(style.rgb),
      iconColor: style.iconColor,
    };
  });

  const activeItem = items.find(
    (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
  );

  if (loading) {
    return (
      <div className="fixed left-1/2 top-16 z-40 w-[75%] -translate-x-1/2 rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)] p-2 shadow-[var(--ui-card-shadow)] backdrop-blur-lg">
        <div className="h-11 w-full animate-pulse rounded-xl bg-[var(--ui-subtle-bg)]" />
      </div>
    );
  }

  return (
    <MenuBar
      items={items}
      activeItem={activeItem?.label}
      onItemClick={(label) => {
        const target = items.find((i) => i.label === label);
        if (target) router.push(target.href as any);
      }}
      className="fixed left-1/2 top-16 z-40 w-[75%] -translate-x-1/2"
    />
  );
}
