"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppNav } from "../../components/app-nav";
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
      <main className="flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      </main>
    );
  }
  return (
    <>
      <AppNav />
      {/* Content: clears the bottom tab bar on mobile, the sidebar on desktop. */}
      <div className="pb-20 lg:pb-0 lg:pl-60">{children}</div>
    </>
  );
}
