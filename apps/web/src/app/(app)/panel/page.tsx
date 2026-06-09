"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

/** Minimal authenticated landing — real app screens arrive with W2 (coaching). */
export default function PanelPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-5 py-16">
      <h1
        className="text-3xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Merhaba, {user?.displayName} 👋
      </h1>
      <p style={{ color: "var(--color-secondary)" }}>
        {user?.emailVerified
          ? "E-postan doğrulanmış. Hazırsın!"
          : "E-postanı henüz doğrulamadın — gelen kutunu kontrol et."}
      </p>
      <p style={{ color: "var(--color-secondary)" }}>
        Çalışma planı, seans ve analiz ekranları yakında burada olacak.
      </p>
      <button
        type="button"
        onClick={() => void logout().then(() => router.replace("/giris"))}
        className="w-fit rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white"
        style={{ backgroundColor: "var(--color-btn)", boxShadow: "var(--shadow-card)" }}
      >
        Çıkış yap
      </button>
    </main>
  );
}
