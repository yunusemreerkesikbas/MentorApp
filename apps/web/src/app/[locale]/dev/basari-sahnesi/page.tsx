import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { pickMessages } from "@/i18n/scoped-messages";

import { AchievementScenePreview } from "./_components/achievement-scene-preview";

/**
 * Development only: plays the "Işık Yandı" achievement scene with sample data, no API or earned
 * achievement needed (`pnpm dev`, then /dev/basari-sahnesi). Production builds answer 404.
 */
export default async function AchievementScenePreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider messages={pickMessages(await getMessages(), ["achievements"])}>
      <AchievementScenePreview />
    </NextIntlClientProvider>
  );
}
