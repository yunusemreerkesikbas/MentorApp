import { Suspense } from "react";
import { CheckoutResultContent } from "./_components/checkout-result-content";

export default function CheckoutResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[40vh] w-full max-w-md items-center justify-center px-5 py-16">
          <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
        </main>
      }
    >
      <CheckoutResultContent />
    </Suspense>
  );
}
