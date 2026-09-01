import { setRequestLocale } from "@/i18n/locale";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
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
        <main
          className="fixed inset-0 z-[90] grid place-items-center bg-[var(--color-bg)] px-5"
          aria-busy
        >
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
