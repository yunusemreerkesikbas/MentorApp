"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { postAuthDestination } from "@/lib/post-auth-destination";
import { isWelcomeSeen } from "@/lib/welcome-seen";

/** Redirect authenticated users and return visitors who already saw the welcome slider. */
export function WelcomeGuard({ children }: { children: ReactNode }) {
  const t = useTranslations("welcome");
  const router = useRouter();
  const { status, user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && user) {
      router.replace(postAuthDestination(user));
      return;
    }
    if (isWelcomeSeen()) {
      router.replace("/giris");
      return;
    }
    setReady(true);
  }, [status, user, router]);

  if (status === "loading" || !ready) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        aria-busy="true"
      >
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("loading")}
        </p>
      </main>
    );
  }

  return children;
}
