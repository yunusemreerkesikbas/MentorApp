"use client";
import { BadgeCheck, BookOpen, Calendar, ChartColumn, Coins, Crown, Gem, House, MessageCircle, User, Users } from "lucide-react";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { AuthUser, EconomyBalance, SubscriptionView } from "@mentor/types";
import { NotificationBell } from "@mentor/ui";
import { subscriptionsControllerGetMine } from "@mentor/api-client";

import { LanguageToggle } from "@/components/language-toggle";
import { DesktopCoachFab } from "@/components/desktop-coach-fab";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  ECONOMY_CHANGED_EVENT,
  fetchEconomyBalance,
  isEconomyDisabled,
} from "@/lib/economy";
import { isNavActive } from "@/lib/nav-active";

/** Chrome micro-motion — DESIGN.md §9 (~150–250ms, ease-out). */
const TAB_EASE = [0.22, 1, 0.36, 1] as const;
/**
 * App navigation (DESIGN.md §6 Tab bar + §8 adaptation):
 *  - mobile: avatar header + floating pill tab (Koç elevated center, icons only)
 *  - ≥1024px (lg): left sidebar with sentence-case labels; Koç is desktop floating
 *    Puhu FAB (bottom-right), not a sidebar item
 * Profile is avatar-only on mobile; sidebar keeps Profil + Topluluk.
 */

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "home", icon: House },
  { href: "/plan", labelKey: "plan", icon: Calendar },
  { href: "/coach", labelKey: "coach", icon: MessageCircle, sidebarExclude: true },
  { href: "/analysis", labelKey: "analysis", icon: ChartColumn },
  { href: "/knowledge", labelKey: "knowledge", icon: BookOpen },
  { href: "/community", labelKey: "community", icon: Users, sidebarOnly: true },
  { href: "/profile", labelKey: "profile", icon: User, sidebarOnly: true },
] as const;

const TAB_ITEMS = NAV_ITEMS.filter((i) => !("sidebarOnly" in i && i.sidebarOnly));
const SIDEBAR_ITEMS = NAV_ITEMS.filter(
  (i) => !("sidebarExclude" in i && i.sidebarExclude),
);

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const ui = useTranslations("common");
  const { user } = useAuth();
  const [balance, setBalance] = useState<EconomyBalance | null>(null);
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    let active = true;

    function loadBalance() {
      fetchEconomyBalance()
        .then((next) => {
          if (active) setBalance(next);
        })
        .catch((err: unknown) => {
          if (!active) return;
          if (!isEconomyDisabled(err)) setBalance(null);
        });
    }

    loadBalance();
    subscriptionsControllerGetMine()
      .then((raw) => {
        if (!active) return;
        const view = raw as unknown as SubscriptionView;
        setPremium(Boolean(view.entitlement?.isPremium));
      })
      .catch(() => {
        if (active) setPremium(false);
      });

    function onEconomyChanged() {
      loadBalance();
    }
    function onVisible() {
      if (document.visibilityState === "visible") loadBalance();
    }

    window.addEventListener(ECONOMY_CHANGED_EVENT, onEconomyChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener(ECONOMY_CHANGED_EVENT, onEconomyChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-1 border-r border-white bg-white/50 p-5 backdrop-blur lg:flex"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label={t("aria_label")}
      >
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-11 items-center text-2xl font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          Mentor
        </Link>

        {user ? (
          <SidebarIdentity
            balance={balance}
            premium={premium}
            user={user}
          />
        ) : null}

        <div className="mt-2 flex flex-col gap-1">
          {SIDEBAR_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              active={isNavActive(pathname, item.href)}
            />
          ))}
        </div>

        <div
          className="mt-auto border-t pt-4"
          style={{ borderColor: "var(--color-secondary-light, #e5e7eb)" }}
        >
          <LanguageToggle />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-3 border-b border-black/10 bg-white/90 px-4 backdrop-blur lg:hidden">
        {user ? (
          <MobileIdentity premium={premium} user={user} />
        ) : (
          <Link
            href="/dashboard"
            className="text-xl font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            Mentor
          </Link>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <EconomyPills balance={balance} />
          <NotificationBell
            label={ui("notifications_label")}
            unreadLabel={ui("notifications_unread_label")}
          />
        </div>
      </header>

      <nav
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 lg:hidden"
        aria-label={t("aria_label")}
      >
        <MobileTabBar pathname={pathname} />
      </nav>

      {!pathname.startsWith("/coach") ? <DesktopCoachFab /> : null}
    </>
  );
}

function MobileTabBar({ pathname }: { pathname: string }) {
  const t = useTranslations("nav");
  const reduceMotion = useReducedMotion();
  const tabTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.8 };

  return (
    <motion.div
      className="flex h-[60px] items-center rounded-full border border-black/8 bg-white px-1.5 shadow-[var(--shadow-card)]"
      initial={reduceMotion ? false : { y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.28, ease: TAB_EASE }
      }
    >
      {TAB_ITEMS.map((item) => (
        <MobileTabLink
          key={item.href}
          item={item}
          label={t(item.labelKey)}
          active={isNavActive(pathname, item.href)}
          reduceMotion={Boolean(reduceMotion)}
          transition={tabTransition}
        />
      ))}
    </motion.div>
  );
}

function MobileTabLink({
  item,
  label,
  active,
  reduceMotion,
  transition,
}: {
  item: (typeof TAB_ITEMS)[number];
  label: string;
  active: boolean;
  reduceMotion: boolean;
  transition:
    | { duration: number }
    | { type: "spring"; stiffness: number; damping: number; mass: number };
}) {
  const isCoach = item.href === "/coach";
  const Icon = item.icon;
  const tap = reduceMotion ? undefined : { scale: 0.94 };

  if (isCoach) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className="relative flex h-full min-w-0 flex-1 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
      >
        <motion.span
          className="absolute -top-3 grid size-11 place-items-center rounded-full shadow-[var(--shadow-card)]"
          animate={{
            backgroundColor: active ? "var(--color-main)" : "#ffffff",
            color: active ? "#ffffff" : "var(--color-main)",
          }}
          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
          whileTap={tap}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: TAB_EASE }}
        >
          <Icon size={20} strokeWidth={active ? 2.4 : 2.15} aria-hidden />
        </motion.span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className="relative flex h-full min-w-0 flex-1 items-center justify-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
    >
      <motion.span
        className="relative grid size-11 place-items-center"
        animate={{
          color: active ? "#ffffff" : "var(--color-secondary)",
        }}
        whileHover={
          reduceMotion || active ? undefined : { color: "var(--color-main)" }
        }
        whileTap={tap}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: TAB_EASE }}
      >
        {active ? (
          <motion.span
            layoutId="mobile-tab-active-circle"
            className="absolute inset-0 rounded-full bg-[var(--color-main)]"
            transition={transition}
            aria-hidden
          />
        ) : null}
        <span className="relative">
          <NavIcon icon={Icon} active={active} />
        </span>
      </motion.span>
    </Link>
  );
}

function MobileIdentity({
  premium,
  user,
}: {
  premium: boolean;
  user: AuthUser;
}) {
  const t = useTranslations("nav");
  const greeting = t(greetingKeyForHour());

  return (
    <>
      <AvatarLink premium={premium} user={user} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-base font-bold leading-tight text-[var(--color-main)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {greeting}
        </p>
        <p className="truncate text-sm leading-tight text-[var(--color-secondary)]">
          {user.displayName}
        </p>
      </div>
    </>
  );
}

function SidebarIdentity({
  balance,
  premium,
  user,
}: {
  balance: EconomyBalance | null;
  premium: boolean;
  user: AuthUser;
}) {
  const t = useTranslations("nav");
  const ui = useTranslations("common");
  const greeting = t(greetingKeyForHour());

  // ponytail: no card chrome — identity sits flush in the sidebar rail
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <AvatarLink premium={premium} size="lg" user={user} />
        <NotificationBell
          label={ui("notifications_label")}
          unreadLabel={ui("notifications_unread_label")}
        />
      </div>
      <div className="mt-3 min-w-0">
        <p
          className="text-lg font-bold leading-snug text-[var(--color-main)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {greeting}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--color-secondary)]">
          {user.displayName}
        </p>
      </div>
      {balance ? (
        <div className="mt-3">
          <EconomyPills balance={balance} />
        </div>
      ) : null}
    </div>
  );
}

function AvatarLink({
  premium,
  size = "md",
  user,
}: {
  premium: boolean;
  size?: "md" | "lg";
  user: AuthUser;
}) {
  const t = useTranslations("nav");
  const src = resolveAvatarUrl(user.avatarUrl);
  const sizeClass = size === "lg" ? "size-14 text-base" : "size-11 text-sm";

  return (
    <Link
      href="/profile"
      aria-label={t("profile_link")}
      className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {src ? (
        // ponytail: plain img — same as profile header (signed/public object URL).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <span
          className={`grid ${sizeClass} place-items-center rounded-full font-bold`}
          style={{
            backgroundColor: "#D6DBFD",
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
          aria-hidden
        >
          {initials(user.displayName)}
        </span>
      )}
      <AvatarBadge premium={premium} verified={user.emailVerified} />
    </Link>
  );
}

function AvatarBadge({ premium, verified }: { premium: boolean; verified: boolean }) {
  const t = useTranslations("nav");
  if (!premium && !verified) return null;

  return (
    <span
      role="img"
      aria-label={premium ? t("badge_premium") : t("badge_verified")}
      title={premium ? t("badge_premium") : t("badge_verified")}
      className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-white bg-white text-[var(--color-main)] shadow-[var(--shadow-card)]"
    >
      {premium ? (
        <Crown className="size-3 text-[var(--color-progress)]" strokeWidth={2.4} aria-hidden />
      ) : (
        <BadgeCheck className="size-3.5 text-[var(--color-main)]" strokeWidth={2.2} aria-hidden />
      )}
    </span>
  );
}

function EconomyPills({ balance }: { balance: EconomyBalance | null }) {
  const t = useTranslations("nav");
  if (!balance) return null;

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={t("earned_rights_label")}
    >
      {/* Coins → the spendable currency; Gem → XP reputation. Don't swap these back. */}
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_40%,white)] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--color-main)]">
        <Coins className="size-3.5 text-[var(--color-progress)]" aria-hidden />
        {formatCompact(balance.coinConfirmed)}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,#FCD34D_30%,white)] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--color-main)]">
        <Gem className="size-3.5 text-[#B7791F]" aria-hidden />
        {formatCompact(balance.xp)}
      </span>
    </div>
  );
}

function NavLink({
  item,
  label,
  active,
}: {
  item: (typeof SIDEBAR_ITEMS)[number];
  label: string;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none ${
        active ? "bg-white/80" : "hover:bg-white/60"
      }`}
      style={{
        color: active ? "var(--color-main)" : "var(--color-secondary)",
        fontFamily: "var(--font-body)",
        fontWeight: active ? 700 : 400,
      }}
    >
      <NavIcon icon={Icon} active={active} />
      {label}
    </Link>
  );
}

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function greetingKeyForHour(): "greeting_morning" | "greeting_day" | "greeting_evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 18) return "greeting_day";
  return "greeting_evening";
}
