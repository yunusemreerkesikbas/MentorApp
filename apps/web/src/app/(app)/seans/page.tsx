import { Suspense } from "react";
import { SeansShell } from "./_components/seans-shell";

export default function SeansPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[40vh] w-full max-w-lg items-center justify-center px-5 py-8">
          <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
        </main>
      }
    >
      <SeansShell />
    </Suspense>
  );
}
