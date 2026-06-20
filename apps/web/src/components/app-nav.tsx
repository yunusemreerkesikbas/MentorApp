"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isNavActive } from "@/lib/nav-active";
import { LanguageToggle } from "@/components/language-toggle";

/**
 * App navigation (DESIGN.md §6 Tab bar + §8 adaptation):
 *  - mobile: fixed bottom tab bar (white, 1px top divider, Spartan SemiBold UPPERCASE labels)
 *  - ≥1024px (lg): fixed left sidebar with the same items
 * Active = --color-main, inactive = --color-secondary (no accent fill — Nuton).
 */

const NAV_ITEMS = [
  { href: "/panel", labelKey: "home", icon: HomeIcon },
  { href: "/plan", labelKey: "plan", icon: CalendarIcon },
  { href: "/koc", labelKey: "coach", icon: CoachIcon },
  { href: "/analiz", labelKey: "analysis", icon: ChartIcon },
  { href: "/bilgi", labelKey: "knowledge", icon: BookIcon },
  { href: "/profil", labelKey: "profile", icon: UserIcon },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-1 border-r border-white bg-white/50 p-6 backdrop-blur lg:flex"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label={t("aria_label")}
      >
        <Link
          href="/panel"
          className="mb-6 inline-flex min-h-[44px] items-center text-2xl font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          Mentor
        </Link>
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

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex min-h-[63px] border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={t("aria_label")}
      >
        {NAV_ITEMS.map((item) => (
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
        <Icon active={active} />
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
      <Icon active={active} />
      <span
        className="max-w-full truncate text-[9px] font-semibold uppercase tracking-wide"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
    </Link>
  );
}

type IconProps = { active?: boolean };

function iconProps(active?: boolean) {
  return {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: active ? 2.25 : 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
}

function HomeIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function CalendarIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function ChartIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function BookIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
function UserIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function CoachIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </svg>
  );
}
