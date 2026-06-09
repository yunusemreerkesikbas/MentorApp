"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../../lib/auth-context";

/** Auth guard for the app area: anonymous users are redirected to /giris. */
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
  return <>{children}</>;
}
