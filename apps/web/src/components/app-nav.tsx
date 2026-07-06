"use client";

import type { LucideIcon } from "lucide-react";
import BookOpen from "lucide-react/dist/esm/icons/book-open.mjs";
import Calendar from "lucide-react/dist/esm/icons/calendar.mjs";
import ChartColumn from "lucide-react/dist/esm/icons/chart-column.mjs";
import House from "lucide-react/dist/esm/icons/house.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import User from "lucide-react/dist/esm/icons/user.mjs";
import Users from "lucide-react/dist/esm/icons/users.mjs";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NotificationBell } from "@mentor/ui";
import { isNavActive } from "@/lib/nav-active";
import { LanguageToggle } from "@/components/language-toggle";

/**
 * App navigation (DESIGN.md §6 Tab bar + §8 adaptation):
 *  - mobile: fixed bottom tab bar (white, 1px top divider, Nunito Sans SemiBold UPPERCASE labels)
 *  - ≥1024px (lg): fixed left sidebar with the same items
 * Active = --color-main, inactive = --color-secondary (no accent fill — Nuton).
 */

const NAV_ITEMS = [
  { href: "/panel", labelKey: "home", icon: House },
  { href: "/plan", labelKey: "plan", icon: Calendar },
  { href: "/koc", labelKey: "coach", icon: MessageCircle },
  { href: "/analiz", labelKey: "analysis", icon: ChartColumn },
  { href: "/bilgi", labelKey: "knowledge", icon: BookOpen },
  // Sidebar-only (desktop): the mobile tab bar stays at 6; community entry on mobile is the panel card.
  { href: "/topluluk", labelKey: "community", icon: Users, sidebarOnly: true },
  { href: "/profil", labelKey: "profile", icon: User },
] as const;

const TAB_ITEMS = NAV_ITEMS.filter((i) => !("sidebarOnly" in i && i.sidebarOnly));

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const ui = useTranslations("common");

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-1 border-r border-white bg-white/50 p-6 backdrop-blur lg:flex"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label={t("aria_label")}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/panel"
            className="inline-flex min-h-[44px] items-center text-2xl font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Mentor
          </Link>
          <NotificationBell
            label={ui("notifications_label")}
            unreadLabel={ui("notifications_unread_label")}
          />
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            label={t(item.labelKey)}
            active={isNavActive(pathname, item.href)}
            variant="side"
          />
        ))}

        <div
          className="mt-auto border-t pt-4"
          style={{ borderColor: "var(--color-secondary-light, #e5e7eb)" }}
        >
          <LanguageToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-black/10 bg-white/80 px-4 backdrop-blur lg:hidden">
        <Link
          href="/panel"
          className="text-xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Mentor
        </Link>
        <NotificationBell
          label={ui("notifications_label")}
          unreadLabel={ui("notifications_unread_label")}
        />
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex min-h-[63px] border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={t("aria_label")}
      >
        {TAB_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            label={t(item.labelKey)}
            active={isNavActive(pathname, item.href)}
            variant="tab"
          />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  item,
  label,
  active,
  variant,
}: {
  item: (typeof NAV_ITEMS)[number];
  label: string;
  active: boolean;
  variant: "side" | "tab";
}) {
  const color = active ? "var(--color-main)" : "var(--color-secondary)";
  const Icon = item.icon;

  if (variant === "side") {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-[44px] items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none ${
          active ? "bg-white/80" : "hover:bg-white/60"
        }`}
        style={{
          color,
          fontFamily: "var(--font-body)",
          fontWeight: active ? 700 : 400,
        }}
      >
        <NavIcon icon={Icon} active={active} />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className="relative flex min-h-[63px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset motion-reduce:transition-none"
      style={{ color }}
    >
      {active ? (
        <span
          className="absolute inset-x-2 top-0 h-0.5 rounded-full"
          style={{ backgroundColor: "var(--color-main)" }}
          aria-hidden
        />
      ) : null}
      <NavIcon icon={Icon} active={active} />
      <span
        className="max-w-full truncate text-[9px] font-semibold uppercase tracking-wide"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
    </Link>
  );
}

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />;
}
