"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppNav } from "../../components/app-nav";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "../../lib/app-shell";
import { useAuth } from "../../lib/auth-context";

/**
 * App shell + auth guard: anonymous users are redirected to /giris.
 * Layout (DESIGN.md §8): bottom tab bar on mobile, left sidebar ≥1024px.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/giris");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <AppNav />
      <div className={`min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0 lg:pl-60`}>
        {children}
      </div>
    </div>
  );
}
