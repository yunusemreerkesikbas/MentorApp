"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { UserRole } from "@mentor/types";
import { Button } from "@mentor/ui";

import { AppNav } from "@/components/app-nav";
import { Link, useRouter } from "@/i18n/navigation";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { useAuth } from "@/lib/auth-context";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";

/**
 * Auth + COACH role guard for the human-coach route group. Navigation reuses the role-aware
 * `AppNav`; mentorship remains a separate route and authorization boundary.
 *
 * The guard is a courtesy, not a security boundary — every endpoint behind these screens re-checks
 * the role AND the coach-student link server-side.
 */

export function CoachShell({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("mentorship");

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
      <div
        className="coach-signals min-h-screen"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <AppNav />
        <div
          className={`mentor-app-shell min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0`}
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:py-10">
            {children}
          </div>
        </div>
      </div>
    </NotificationDrawerShell>
  );
}
