"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { UserRole } from "@mentor/types";
import { Button } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Auth + COACH role guard, plus the coach chrome. Mirrors `(app)/app-shell.tsx` but does not
 * import it: the two surfaces are meant to drift apart, not stay coupled.
 *
 * This is the first place in `apps/web` that reads `user.roles`. The guard is a courtesy, not
 * a security boundary — every endpoint behind these screens re-checks the role AND the
 * coach-student link server-side.
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
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      {/* The student sidebar does not render here, so this thin bar is the only way back.
          A coach is usually a student too; stranding them on their own roster would be rude. */}
      <header
        className="border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          {/* Brand, not a page title: the page states its own heading right below. */}
          <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            Mentor
          </span>
          <Link
            href="/dashboard"
            className="text-sm underline-offset-4 hover:underline"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("guard_back")}
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 lg:py-10">{children}</div>
    </div>
  );
}
