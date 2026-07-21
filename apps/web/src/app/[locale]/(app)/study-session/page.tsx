import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StudySessionShell } from "./_components/study-session-shell";

export default async function StudySessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
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
      <StudySessionShell />
    </Suspense>
  );
}
