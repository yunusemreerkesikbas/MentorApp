"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { IdCard, Settings, Users, UsersRound, type LucideIcon } from "lucide-react";
import { UserRole } from "@mentor/types";
import { Button, NotificationBell } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";

/**
 * Auth + COACH role guard, plus the coach chrome. Mirrors `(app)/app-shell.tsx` but does not
 * import it: the two surfaces are meant to drift apart, not stay coupled.
 *
 * The guard is a courtesy, not a security boundary — every endpoint behind these screens re-checks
 * the role AND the coach-student link server-side.
 *
 * SINCE APP-090 THIS IS THE COACH'S HOME, not a side trip from the student panel, and the chrome
 * grew to match: a nav row and a notification bell where there used to be one "back to the panel"
 * link. That link is gone because the panel is gone for them — `isStudentOnlyPath` bounces a coach
 * off `/panel` and the rest of the daily ritual.
 *
 * `AppNav` is still NOT reused, and the reason is the layout docblock's: it is 716 lines of student
 * chrome (coin pills, theme lamp, the AI-companion FAB, a cookie-persisted sidebar) built around a
 * daily ritual. This surface is a work tool. What a coach needs from navigation is four links and
 * an unread count, and that is cheaper to write than to filter.
 */

const NAV: { href: "/students" | "/students/profile" | "/community" | "/settings"; labelKey: string; icon: LucideIcon }[] = [
  { href: "/students", labelKey: "students", icon: UsersRound },
  { href: "/students/profile", labelKey: "profile", icon: IdCard },
  // Kept deliberately: roadmap §5 makes the forum the coach's showcase and the raw material of
  // their trust score, so it is not a student-only surface even though it lives in `(app)`.
  { href: "/community", labelKey: "community", icon: Users },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

export function CoachShell({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("mentorship");
  const nav = useTranslations("nav");
  const ui = useTranslations("common");

  const isCoach = user?.roles.includes(UserRole.COACH) ?? false;

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }

  if (!isCoach) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {t("guard_title")}
        </h1>
        <p className="max-w-sm" style={{ color: "var(--color-secondary)" }}>
          {t("guard_body")}
        </p>
        <Link href="/dashboard">
          <Button variant="secondary">{t("guard_back")}</Button>
        </Link>
      </main>
    );
  }

  return (
    <NotificationDrawerShell>
      <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
        <header className="border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-3 sm:px-8">
            {/* Brand, not a page title: every page states its own heading right below. */}
            <span
              className="mr-1 shrink-0 text-sm font-semibold"
              style={{ color: "var(--color-main)" }}
            >
              Mentor
            </span>

            {/* Scrolls rather than wraps: a second chrome row on a phone would push the roster —
                the thing the coach actually came for — below the fold. */}
            <nav
              aria-label={nav("aria_label")}
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
            >
              {NAV.map(({ href, labelKey, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-card)] px-2.5 py-2 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                  style={{ color: "var(--color-main)" }}
                >
                  <Icon size={18} aria-hidden />
                  {/* The icon carries a phone; the label is what makes it unambiguous at a desk. */}
                  <span className="hidden sm:inline">{nav(labelKey)}</span>
                </Link>
              ))}
            </nav>

            {/* `relative` so the desktop popover anchors here, matching AppNav's header. */}
            <div className="relative shrink-0">
              <NotificationBell
                label={ui("notifications_label")}
                unreadLabel={ui("notifications_unread_label")}
                desktopSide="right"
              />
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:py-10">{children}</div>
      </div>
    </NotificationDrawerShell>
  );
}
