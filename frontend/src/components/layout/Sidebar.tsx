"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { LogOut, Settings, CreditCard, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/context/LocaleContext";

// Plan product names — brand names kept as-is across locales (matches the
// upgrade picker's PLAN_NAME), so no i18n lookup is needed here.
const PLAN_NAMES: Record<string, string> = {
  FREE:      "Free",
  MONTHLY:   "Reserve",
  QUARTERLY: "Treasury",
  ANNUAL:    "Sovereign",
};

interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  subscription?: string;
}

/**
 * A floating account pill — the bottom-left cluster (Subscription, Settings,
 * Profile, Sign out). Same reveal mechanic as the original sidebar: sits
 * mostly off-canvas via negative margin, slides in on hover/tap. Restyled to
 * match the top category bar (frosted glass + a colored glow behind the
 * icon) instead of a solid gradient fill, so the two floating pieces read as
 * one system. Order matters: label first, icon last, so the icon (not the
 * label's tail) is what's left showing in the collapsed sliver.
 * `active` only tints the glow — it does not keep the pill expanded.
 */
function Pill({
  id,
  icon: Icon,
  avatar,
  label,
  iconColor,
  glowRgb,
  active = false,
  revealed = false,
  href,
  onClick,
}: {
  id: string;
  icon?: React.ElementType;
  avatar?: { src?: string; initials: string };
  label: string;
  iconColor: string;
  glowRgb: string; // "r,g,b"
  active?: boolean;
  revealed?: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const expanded = revealed;

  const content = (
    <>
      <span
        className={cn(
          "absolute inset-0 rounded-r-xl transition-opacity duration-300",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        style={{ background: `radial-gradient(circle, rgba(${glowRgb},0.35) 0%, transparent 70%)` }}
      />
      <span
        className={cn(
          "relative flex-1 truncate text-sm font-semibold whitespace-nowrap",
          active ? "text-[var(--ui-text-pri)]" : "text-[var(--ui-text-sec)] group-hover:text-[var(--ui-text-pri)]"
        )}
      >
        {label}
      </span>
      {Icon && <Icon className={cn("relative h-[17px] w-[17px] shrink-0", iconColor)} />}
      {avatar && (
        avatar.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar.src} alt="" className="relative h-[20px] w-[20px] shrink-0 rounded-full object-cover" />
        ) : (
          <span className={cn("relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--ui-subtle-bg)] text-[10px] font-bold", iconColor)}>
            {avatar.initials}
          </span>
        )
      )}
    </>
  );

  const className = cn(
    "group relative flex h-[42px] w-[172px] shrink-0 items-center justify-between gap-2.5 overflow-hidden rounded-r-xl px-3.5",
    "bg-[var(--ui-card-bg)] border border-[var(--ui-card-border)] shadow-[var(--ui-card-shadow)] backdrop-blur-lg",
    "transition-[margin-left,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
    "hover:-ml-3 focus-visible:-ml-3 focus-visible:outline-none",
    expanded ? "-ml-3" : "-ml-[122px]"
  );

  if (href) {
    return (
      <Link href={href as any} onClick={onClick} className={className} data-pill-id={id}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} data-pill-id={id}>
        {content}
      </button>
    );
  }
  return (
    <div tabIndex={0} className={className} data-pill-id={id}>
      {content}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { setTheme } = useTheme();
  const { t } = useLocale();

  const [user, setUser] = useState<UserInfo | null>(null);
  // Set synchronously on click, before Next's navigation resolves, so the
  // highlight moves immediately instead of waiting for the new route to
  // finish loading. Cleared the moment any navigation actually commits.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Touch has no hover: first tap on a collapsed pill reveals its label,
  // a second tap (now that it's revealed) navigates. Desktop ignores this
  // entirely — CSS :hover already reveals before the click lands.
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
    setRevealedId(null);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.user) setUser(data.user); })
      .catch(() => {});
  }, []);

  // Collapse a tap-revealed pill when the user taps anywhere else.
  useEffect(() => {
    if (!revealedId) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-pill-id="${revealedId}"]`)) {
        setRevealedId(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [revealedId]);

  const handleSignOut = async () => {
    // Sign-out drops the user's saved theme; fall back to the OS setting.
    // The DB preference is untouched and restored by PreferencesSync on next sign-in.
    setTheme("system");
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleLock = async () => {
    await fetch("/api/auth/lock", { method: "POST" });
    router.push("/unlock");
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const subscriptionLabel = PLAN_NAMES[user?.subscription ?? "FREE"] ?? PLAN_NAMES.FREE;
  const effectivePath = pendingHref ?? pathname;

  /**
   * Touch: first tap on a collapsed pill only reveals it (prevents the
   * navigation, marks it revealed); tapping it again navigates. Desktop
   * mice always navigate immediately — CSS :hover already showed the label.
   */
  const handlePillTap = useCallback(
    (e: React.MouseEvent, id: string, href: string, alreadyExpanded: boolean) => {
      const isCoarsePointer = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
      if (isCoarsePointer && !alreadyExpanded) {
        e.preventDefault();
        setRevealedId(id);
        return;
      }
      setPendingHref(href);
      setRevealedId(null);
    },
    []
  );

  const subscriptionActive = effectivePath === "/subscription";
  const settingsActive = effectivePath === "/settings";

  return (
    <div className="fixed bottom-4 left-0 z-40 flex flex-col gap-2">
      <Pill
        id="/subscription"
        icon={CreditCard}
        label={`${t.sidebar.subscription} · ${subscriptionLabel}`}
        iconColor="text-orange-600"
        glowRgb="234,88,12"
        active={subscriptionActive}
        revealed={revealedId === "/subscription"}
        href="/subscription"
        onClick={(e) => handlePillTap(e, "/subscription", "/subscription", revealedId === "/subscription")}
      />

      <Pill
        id="/settings"
        icon={Settings}
        label={t.sidebar.settings}
        iconColor="text-slate-500"
        glowRgb="100,116,139"
        active={settingsActive}
        revealed={revealedId === "/settings"}
        href="/settings"
        onClick={(e) => handlePillTap(e, "/settings", "/settings", revealedId === "/settings")}
      />

      <Pill
        id="identity"
        avatar={{ src: user?.avatar, initials }}
        label={user?.name ?? "…"}
        iconColor="text-pink-600"
        glowRgb="219,39,119"
        revealed={revealedId === "identity"}
        onClick={(e) => {
          e.preventDefault();
          setRevealedId((v) => (v === "identity" ? null : "identity"));
        }}
      />

      <Pill
        id="lock"
        icon={Lock}
        label={t.sidebar.lockScreen}
        iconColor="text-green-600"
        glowRgb="22,163,74"
        revealed={revealedId === "lock"}
        onClick={(e) => {
          const isCoarsePointer = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
          if (isCoarsePointer && revealedId !== "lock") {
            e.preventDefault();
            setRevealedId("lock");
            return;
          }
          handleLock();
        }}
      />

      <Pill
        id="signout"
        icon={LogOut}
        label={t.sidebar.logout}
        iconColor="text-red-600"
        glowRgb="220,38,38"
        revealed={revealedId === "signout"}
        onClick={(e) => {
          const isCoarsePointer = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
          if (isCoarsePointer && revealedId !== "signout") {
            e.preventDefault();
            setRevealedId("signout");
            return;
          }
          handleSignOut();
        }}
      />
    </div>
  );
}
