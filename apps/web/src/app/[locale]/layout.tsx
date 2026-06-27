import type { Metadata } from "next";
import { Lato, League_Spartan } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { BackgroundBlobs } from "@mentor/ui";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProviderShell } from "@/lib/toast-provider-shell";
import { DialogProviderShell } from "@/lib/dialog-provider-shell";
import "../globals.css";

/* DESIGN.md §3 — headings: League Spartan, body: Lato. latin-ext covers Turkish glyphs
   (ç ğ ı İ ş ö ü). The CSS variables override the @theme defaults in @mentor/ui/theme.css. */
const heading = League_Spartan({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});
const body = Lato({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-body",
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
    <html lang={locale} className={`${heading.variable} ${body.variable}`}>
      <head>
        {/* Material Symbols Outlined — used by notification drawer icons */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body
          attributes pre-hydration; this silences only attribute diffs on <body>. */}
      <body suppressHydrationWarning>
        <BackgroundBlobs />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProviderShell>
            <DialogProviderShell>
              <AuthProvider>{children}</AuthProvider>
            </DialogProviderShell>
          </ToastProviderShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
