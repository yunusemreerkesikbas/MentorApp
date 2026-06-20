import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SeansShell } from "./_components/seans-shell";

export default async function SeansPage() {
  const translate = await getTranslations("common");
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[40vh] w-full max-w-lg items-center justify-center px-5 py-8">
          <p style={{ color: "var(--color-secondary)" }}>
            {translate("loading")}
          </p>
        </main>
      }
    >
      <SeansShell />
    </Suspense>
  );
}
