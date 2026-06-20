import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { BackgroundBlobs } from "@mentor/ui";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth-context";

const META = {
  tr: {
    title: "Mentor — Sınav Yoldaşın",
    description:
      "Sınav hazırlığında seni anlayan, devam ettiren ve yalnız bırakmayan AI koç + topluluk.",
    ogLocale: "tr_TR" as const,
  },
  en: {
    title: "Mentor — Your Exam Companion",
    description:
      "An AI coach + community that understands you, keeps you going, and never leaves you alone on the road to your exam.",
    ogLocale: "en_US" as const,
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = locale === "en" ? META.en : META.tr;
  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.title,
      description: m.description,
      locale: m.ogLocale,
    },
  };
}

/**
 * Locale layout — wraps all pages with NextIntlClientProvider + AuthProvider.
 * Metadata is locale-aware via generateMetadata above.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Reject unknown first segments (e.g. /xyz) instead of rendering them as the default locale.
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
  const messages = await getMessages();

  return (
    <>
      <BackgroundBlobs />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>{children}</AuthProvider>
      </NextIntlClientProvider>
    </>
  );
}
