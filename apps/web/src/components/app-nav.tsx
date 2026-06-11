"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * App navigation (DESIGN.md §6 Tab bar + §8 adaptation):
 *  - mobile: fixed bottom tab bar (white, 1px top divider, Spartan SemiBold UPPERCASE labels)
 *  - ≥1024px (lg): fixed left sidebar with the same items
 * Active = --color-main, inactive = --color-secondary (no accent fill — Nuton).
 */

const NAV_ITEMS = [
  { href: "/panel", label: "Anasayfa", icon: HomeIcon },
  { href: "/plan", label: "Plan", icon: CalendarIcon },
  { href: "/analiz", label: "Analiz", icon: ChartIcon },
  { href: "/bilgi", label: "Bilgi", icon: BookIcon },
  { href: "/profil", label: "Profil", icon: UserIcon },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-1 border-r border-white bg-white/50 p-6 backdrop-blur lg:flex"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Link
          href="/panel"
          className="mb-6 text-2xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Mentor
        </Link>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} variant="side" />
        ))}
      </aside>

      {/* Mobile bottom tab bar (Nuton: h-63, white, 1px top divider) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 border-t border-black/10 bg-white lg:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} variant="tab" />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  item,
  active,
  variant,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  variant: "side" | "tab";
}) {
  const color = active ? "var(--color-main)" : "var(--color-secondary)";
  const Icon = item.icon;

  if (variant === "side") {
    return (
      <Link
        href={item.href}
        className="flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-base hover:bg-white"
        style={{ color, fontFamily: "var(--font-body)", fontWeight: active ? 700 : 400 }}
      >
        <Icon />
        {item.label}
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      className="flex flex-1 flex-col items-center justify-center gap-1"
      style={{ color }}
    >
      <Icon />
      <span
        className="text-[9px] font-semibold uppercase tracking-wide"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {item.label}
      </span>
    </Link>
  );
}

/* Thin-line icons (Feather style — DESIGN.md §7), 24px box, currentColor stroke. */
function iconProps() {
  return {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

function HomeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
