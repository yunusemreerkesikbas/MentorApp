import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutResultContent } from "./_components/checkout-result-content";

export default async function CheckoutResultPage({
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
        <main className="mx-auto flex min-h-[40vh] w-full max-w-md items-center justify-center px-5 py-16">
          <p style={{ color: "var(--color-secondary)" }}>
            {translate("loading")}
          </p>
        </main>
      }
    >
      <CheckoutResultContent />
    </Suspense>
  );
}
