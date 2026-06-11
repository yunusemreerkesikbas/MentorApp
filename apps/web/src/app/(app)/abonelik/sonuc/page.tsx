"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, Chip } from "@mentor/ui";

function CheckoutResult() {
  const ok = useSearchParams().get("status") === "success";

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-16">
      <Chip>{ok ? "Aboneliğin başladı 🎉" : "Ödeme tamamlanamadı"}</Chip>
      <Card>
        <p style={{ color: "var(--color-secondary)" }}>
          {ok
            ? "Hoş geldin! Deneme süren başladı — Premium özelliklerin tümü açık."
            : "Ödeme sağlayıcısından onay alamadık. Lütfen tekrar dene."}
        </p>
      </Card>
      <Link
        href={ok ? "/panel" : "/abonelik"}
        className="text-sm underline"
        style={{ color: "var(--color-secondary)" }}
      >
        {ok ? "Panele dön" : "Abonelik sayfasına dön"}
      </Link>
    </main>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense>
      <CheckoutResult />
    </Suspense>
  );
}
