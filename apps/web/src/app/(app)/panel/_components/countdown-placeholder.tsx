"use client";

import Link from "next/link";
import { Card } from "@mentor/ui";
import { useAuth } from "../../../../lib/auth-context";

/**
 * Shown when editorial countdown data is missing — guides user to Profil or explains seed gap.
 */
export function CountdownPlaceholder() {
  const { user } = useAuth();
  const hasExamType = Boolean(user?.examType);

  return (
    <Card>
      <p
        className="text-base font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Sınava kalan
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
        {hasExamType
          ? "Resmi sınav takvimi henüz yayımlanmadı. Bilgi merkezinden duyurulduğunda geri sayım burada görünecek."
          : "Sınav tarihi henüz ayarlanmadı. Profilden sınav türünü seçtiğinde geri sayım burada görünecek."}
      </p>
      {!hasExamType ? (
        <Link
          href="/profil"
          className="mt-4 flex min-h-[44px] w-fit items-center rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            backgroundColor: "var(--color-btn)",
            color: "#fff",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          Sınav türünü seç
        </Link>
      ) : null}
    </Card>
  );
}
