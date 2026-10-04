"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { UserRole } from "@mentor/types";
import { Skeleton } from "@mentor/ui";

import { AppNav } from "@/components/app-nav";
import {
  LEDGE,
  LEDGE_OUTLINE,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
} from "@/components/panel/panel-styles";
import { Link, useRouter } from "@/i18n/navigation";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
import { useAuth } from "@/lib/auth-context";
import { NotificationDrawerShell } from "@/lib/notification-drawer-shell";
import { SubscriptionProvider } from "@/lib/subscription-context";

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
    return <CoachShellSkeleton label={t("loading")} />;
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
        {/* A link styled as the ledge: a <button> inside an <a> is invalid HTML. */}
        <Link href="/dashboard" className={`${LEDGE} ${LEDGE_OUTLINE}`}>
          {t("guard_back")}
        </Link>
      </main>
    );
  }

  // The coach shell reads the subscription too: `AppNav` marks a Koç Pro coach the same way it
  // marks a premium student. Same provider, so this surface also asks the API once.
  return (
    <SubscriptionProvider>
      <NotificationDrawerShell>
        <div
          className="coach-signals min-h-screen"
          style={{ backgroundColor: "var(--color-bg)" }}
        >
          <AppNav />
          {/* Each page owns its frame: the panel-language ones use `PANEL_MAIN_CLASS`, the rest
              `COACH_PAGE_FRAME`, so a page and its skeleton always share one. */}
          <div
            className={`mentor-app-shell min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0`}
          >
            {children}
          </div>
        </div>
      </NotificationDrawerShell>
    </SubscriptionProvider>
  );
}

/**
 * While the session resolves: the coach home's shape (greeting, the round, the student list and
 * the rail) inside the offsets the real page gets, instead of a lone "Yükleniyor" line.
 */
function CoachShellSkeleton({ label }: { label: string }) {
  return (
    <div
      className={`mentor-app-shell min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0`}
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <main aria-busy className={PANEL_MAIN_CLASS}>
        <span className="sr-only">{label}</span>
        <Skeleton className="h-9 w-56 rounded-[var(--radius-card)]" />
        <div className={PANEL_GRID_CLASS}>
          <div className="flex min-w-0 flex-col gap-5">
            <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />
            <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
          </div>
          <div className="hidden flex-col gap-5 xl:flex">
            <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
            <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
          </div>
        </div>
      </main>
    </div>
  );
}
