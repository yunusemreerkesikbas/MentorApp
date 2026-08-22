"use client";
import { BookOpen, Calendar, ChartColumn, Coins, Gem, House, MessageCircle, NotebookPen, PanelLeft, Settings, Users } from "lucide-react";

import { useEffect, useLayoutEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { AuthUser, EconomyBalance, SubscriptionView } from "@mentor/types";
import { NotificationBell } from "@mentor/ui";
import { subscriptionsControllerGetMine } from "@mentor/api-client";

import { LanguageToggle } from "@/components/language-toggle";
import { PremiumIdentityMark } from "@/components/premium/premium-identity-mark";
import { ThemeLamp, ThemeLampFooter, MobileThemeLamp } from "@/components/theme-lamp/theme-lamp";
import { DesktopCoachFab } from "@/components/desktop-coach-fab";
import { UserAvatar } from "@/components/user-avatar";
import { Link, usePathname } from "@/i18n/navigation";
import {
  APP_SIDEBAR_COLLAPSED_PX,
  applyAppSidebar,
  isBoardEditorPath,
  parseAppSidebarCookie,
} from "@/lib/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import {
  ECONOMY_CHANGED_EVENT,
  fetchEconomyBalance,
  isEconomyDisabled,
} from "@/lib/economy";
import { isNavActive } from "@/lib/nav-active";
import { useAppSidebar } from "@/lib/use-app-sidebar";

/** Chrome micro-motion — DESIGN.md §9 (~150–250ms, ease-out). */
const TAB_EASE = [0.22, 1, 0.36, 1] as const;
/**
 * App navigation (DESIGN.md §6 Tab bar + §8 adaptation):
 *  - mobile: avatar header + floating pill tab (Koç elevated center, icons only)
 *  - ≥1024px (lg): left sidebar with sentence-case labels; Koç is desktop floating
 *    Puhu FAB (bottom-right), not a sidebar item
 * Public profile is avatar-only on mobile; sidebar keeps Ayarlar + Topluluk.
 */

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "home", icon: House },
  { href: "/plan", labelKey: "plan", icon: Calendar },
  { href: "/coach", labelKey: "coach", icon: MessageCircle, sidebarExclude: true },
  { href: "/analysis", labelKey: "analysis", icon: ChartColumn },
  { href: "/knowledge", labelKey: "knowledge", icon: BookOpen },
  /* Sidebar-only for now: the mobile tab pill is full at five, and the notebook's own return
     path is the review notification, not a tab the user hunts for. */
  { href: "/notebook", labelKey: "notebook", icon: NotebookPen, sidebarOnly: true },
  { href: "/community", labelKey: "community", icon: Users, sidebarOnly: true },
  { href: "/settings", labelKey: "settings", icon: Settings, sidebarOnly: true },
] as const;

const TAB_ITEMS = NAV_ITEMS.filter((i) => !("sidebarOnly" in i && i.sidebarOnly));
const SIDEBAR_ITEMS = NAV_ITEMS.filter(
  (i) => !("sidebarExclude" in i && i.sidebarExclude),
);

const sidebarIconBtn =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-main)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

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

  const isBoardEditor = isBoardEditorPath(pathname);

  return (
    <>
      <DesktopSidebar
        balance={balance}
        pathname={pathname}
        premium={premium}
        user={user}
      />

      {isBoardEditor ? null : (
        <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-3 overflow-visible border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] px-4 backdrop-blur transition-colors duration-200 motion-reduce:transition-none lg:hidden">
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
            <MobileThemeLamp />
            <NotificationBell
              label={ui("notifications_label")}
              unreadLabel={ui("notifications_unread_label")}
            />
          </div>
        </header>
      )}

      {isBoardEditor ? null : (
        <nav
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 lg:hidden"
          aria-label={t("aria_label")}
        >
          <MobileTabBar pathname={pathname} />
        </nav>
      )}

      {!pathname.startsWith("/coach") && !isBoardEditor ? <DesktopCoachFab /> : null}
    </>
  );
}

function DesktopSidebar({
  balance,
  pathname,
  premium,
  user,
}: {
  balance: EconomyBalance | null;
  pathname: string;
  premium: boolean;
  user: AuthUser | null;
}) {
  const t = useTranslations("nav");
  const forceCollapsed = isBoardEditorPath(pathname);
  const { open: storedOpen, setOpen } = useAppSidebar();
  const open = forceCollapsed ? false : storedOpen;

  useLayoutEffect(() => {
    if (!forceCollapsed) return;
    applyAppSidebar(false);
    return () => applyAppSidebar(parseAppSidebarCookie(document.cookie));
  }, [forceCollapsed]);

  return (
    <aside
      className="mentor-app-sidebar fixed inset-y-0 left-0 z-20 hidden overflow-visible flex-col border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_50%,transparent)] backdrop-blur transition-colors duration-200 motion-reduce:transition-none lg:flex"
      style={{ boxShadow: "var(--shadow-card)" }}
      aria-label={t("aria_label")}
      data-testid="app-sidebar"
    >
      <div
        className="mentor-app-sidebar-collapsed absolute inset-y-0 left-0 z-[1] flex flex-col items-center gap-1 px-1 pt-3"
        style={{ width: APP_SIDEBAR_COLLAPSED_PX }}
        aria-hidden={open}
        inert={open}
        data-testid="app-sidebar-collapsed"
      >
        {forceCollapsed ? null : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={sidebarIconBtn}
            aria-expanded={open}
            aria-label={t("sidebar_expand")}
            data-testid="app-sidebar-expand"
          >
            <PanelLeft size={20} strokeWidth={2.25} aria-hidden />
          </button>
        )}
        <div className="flex flex-col items-center gap-1">
          {SIDEBAR_ITEMS.map((item) => (
            <CollapsedNavLink
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              active={isNavActive(pathname, item.href)}
            />
          ))}
        </div>
        <div
          className="mt-auto flex justify-center border-t"
          style={{
            borderColor: "color-mix(in srgb, var(--color-secondary) 24%, transparent)",
          }}
        >
          <ThemeLamp variant="rail" />
        </div>
      </div>

      <div
        className="mentor-app-sidebar-expanded absolute inset-0 flex flex-col gap-1 overflow-visible p-5"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center text-2xl font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Mentor
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={sidebarIconBtn}
            aria-expanded={open}
            aria-label={t("sidebar_collapse")}
            data-testid="app-sidebar-collapse"
          >
            <PanelLeft size={20} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

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

        <ThemeLampFooter>
          <LanguageToggle />
        </ThemeLampFooter>
      </div>
    </aside>
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
      className="flex h-[60px] items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 shadow-[var(--shadow-card)]"
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
            backgroundColor: active ? "var(--color-btn)" : "var(--color-bg)",
            color: active ? "var(--color-btn-label)" : "var(--color-main)",
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
          color: active ? "var(--color-btn-label)" : "var(--color-secondary)",
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
            className="absolute inset-0 rounded-full bg-[var(--color-btn)]"
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
      <AvatarLink user={user} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-base font-bold leading-tight text-[var(--color-main)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {greeting}
        </p>
        <IdentityName name={user.displayName} premium={premium} />
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
        <AvatarLink size="lg" user={user} />
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
        <IdentityName className="mt-1" name={user.displayName} premium={premium} />
      </div>
      {balance ? (
        <div className="mt-3">
          <EconomyPills balance={balance} />
        </div>
      ) : null}
    </div>
  );
}

function IdentityName({
  className = "",
  name,
  premium,
}: {
  className?: string;
  name: string;
  premium: boolean;
}) {
  return (
    <p className={`flex min-w-0 items-center gap-1.5 ${className}`.trim()}>
      <span className="min-w-0 truncate text-sm leading-snug text-[var(--color-secondary)]">
        {name}
      </span>
      {premium ? <PremiumIdentityMark /> : null}
    </p>
  );
}

function AvatarLink({
  size = "md",
  user,
}: {
  size?: "md" | "lg";
  user: AuthUser;
}) {
  const t = useTranslations("nav");
  const avatarSize = size === "lg" ? 56 : 44;

  return (
    <Link
      href={
        user.username
          ? {
              pathname: "/community/member/[username]" as const,
              params: { username: user.username },
            }
          : "/settings"
      }
      aria-label={t("profile_link")}
      className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <UserAvatar name={user.displayName} size={avatarSize} src={user.avatarUrl} />
    </Link>
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
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-progress-track)_40%,var(--color-surface))] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--color-main)]">
        <Coins className="size-3.5 text-[var(--color-progress)]" aria-hidden />
        {formatCompact(balance.coinConfirmed)}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,#FCD34D_30%,var(--color-surface))] px-2 py-1 text-[11px] font-bold tabular-nums text-[var(--color-main)]">
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
      className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none ${
        active
          ? "bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)]"
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

function CollapsedNavLink({
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
      aria-label={label}
      className={`group relative flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none ${
        active
          ? "bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)]"
      }`}
      style={{
        color: active ? "var(--color-main)" : "var(--color-secondary)",
      }}
    >
      <NavIcon icon={Icon} active={active} />
      <span
        aria-hidden
        className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm font-semibold text-[var(--color-main)] opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </Link>
  );
}

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />;
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
