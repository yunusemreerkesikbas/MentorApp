"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/** Auth guard for onboarding — no AppNav. Anonymous → login. */
export function OnboardingGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const t = useTranslations("onboarding");

  useEffect(() => {
    if (status === "anonymous") router.replace("/giris");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }

  return <>{children}</>;
}
