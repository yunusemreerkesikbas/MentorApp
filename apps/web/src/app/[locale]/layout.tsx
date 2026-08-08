import type { Metadata } from "next";
import { Caveat, Nunito_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { BackgroundBlobs } from "@mentor/ui";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProviderShell } from "@/lib/toast-provider-shell";
import { DialogProviderShell } from "@/lib/dialog-provider-shell";
import { BottomSheetProviderShell } from "@/lib/bottom-sheet-provider-shell";
import { AnalyticsConsentProvider } from "@/lib/analytics-consent";
import "../globals.css";

/* DESIGN.md §3 — one smooth UI family for headings + body. latin-ext covers Turkish glyphs
   (ç ğ ı İ ş ö ü). globals.css aliases --font-heading to this body variable. */
const sans = Nunito_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

/* Handwriting face, used ONLY inside vision-board text items — never in app chrome, which stays on
   the single DESIGN.md family. A collage needs a voice that is not the interface's. latin-ext for
   the Turkish glyphs, same as above. */
const script = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-script",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.title,
      description: m.description,
      locale: m.ogLocale,
    },
    verification: googleVerification ? { google: googleVerification } : undefined,
  };
}

/**
 * Root document layout (the `[locale]` segment owns `<html>`/`<body>` so `lang` is set
 * from the awaited param — no dynamic `getLocale()` that would force every page dynamic).
 * Wraps all pages with NextIntlClientProvider + AuthProvider.
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
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${sans.variable} ${script.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body
          attributes pre-hydration; this silences only attribute diffs on <body>. */}
      <body suppressHydrationWarning>
        <BackgroundBlobs />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProviderShell>
            <DialogProviderShell>
              <BottomSheetProviderShell>
                <AnalyticsConsentProvider>
                  <AuthProvider>{children}</AuthProvider>
                </AnalyticsConsentProvider>
              </BottomSheetProviderShell>
            </DialogProviderShell>
          </ToastProviderShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
