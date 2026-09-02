import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { BackgroundBlobs } from "@mentor/ui";
import { routing } from "@/i18n/routing";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { APP_SIDEBAR_BOOTSTRAP_SCRIPT } from "@/lib/app-sidebar";
import { siteUrl } from "@/lib/forum-public";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProviderShell } from "@/lib/toast-provider-shell";
import { DialogProviderShell } from "@/lib/dialog-provider-shell";
import { BottomSheetProviderShell } from "@/lib/bottom-sheet-provider-shell";
import { AnalyticsConsentProvider } from "@/lib/analytics-consent";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { CloudTransitionProvider } from "@/lib/cloud-transition";
import "../globals.css";

/* DESIGN.md §3 — one smooth UI family for headings + body. latin-ext covers Turkish glyphs
   (ç ğ ı İ ş ö ü). globals.css aliases --font-heading to this body variable. */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const META = {
  tr: {
    title: "Mentor: Sınav Yoldaşın",
    description:
      "Sınav hazırlığında seni anlayan, devam ettiren ve yalnız bırakmayan AI koç + topluluk.",
    ogLocale: "tr_TR" as const,
  },
  en: {
    title: "Mentor: Your Exam Companion",
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
  const origin = siteUrl();
  const socialImage = `${origin}/mascot/puhu/puhu-default.png`;
  return {
    metadataBase: new URL(origin),
    applicationName: "Mentor",
    title: m.title,
    description: m.description,
    icons: {
      icon: "/mascot/puhu/puhu-default.png",
      apple: "/mascot/puhu/puhu-default.png",
    },
    openGraph: {
      title: m.title,
      description: m.description,
      locale: m.ogLocale,
      siteName: "Mentor",
      type: "website",
      url: origin,
      images: [{ url: socialImage, alt: "Mentor" }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [socialImage],
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
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages(), ROUTE_MESSAGE_SCOPES.root);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={sans.variable}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: APP_SIDEBAR_BOOTSTRAP_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body
          attributes pre-hydration; this silences only attribute diffs on <body>. */}
      <body suppressHydrationWarning>
        <BackgroundBlobs />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProviderShell>
            <DialogProviderShell>
              <BottomSheetProviderShell>
                <AnalyticsConsentProvider>
                  <WebVitalsReporter />
                  <AuthProvider>
                    <CloudTransitionProvider>{children}</CloudTransitionProvider>
                  </AuthProvider>
                </AnalyticsConsentProvider>
              </BottomSheetProviderShell>
            </DialogProviderShell>
          </ToastProviderShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
