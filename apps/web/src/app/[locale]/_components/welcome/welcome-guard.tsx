"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { postAuthDestination } from "@/lib/post-auth-destination";
import { isWelcomeSeen } from "@/lib/welcome-seen";

const subscribeWelcomeSeen = () => () => undefined;

/** Redirect authenticated users and return visitors who already saw the welcome slider. */
export function WelcomeGuard({ children }: { children: ReactNode }) {
  const t = useTranslations("welcome");
  const router = useRouter();
  const { status, user } = useAuth();
  const welcomeSeen = useSyncExternalStore(
    subscribeWelcomeSeen,
    isWelcomeSeen,
    () => false,
  );

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && user) {
      // @ts-expect-error -- a validated internal path, transported as a plain string.
      router.replace(postAuthDestination(user));
      return;
    }
    if (welcomeSeen) {
      router.replace("/login");
    }
  }, [status, user, router, welcomeSeen]);

  if (status !== "anonymous" || welcomeSeen) {
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
