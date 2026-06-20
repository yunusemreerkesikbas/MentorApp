import type { Metadata } from "next";
import { Lato, League_Spartan } from "next/font/google";
import { getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Mentor — Sınav Yoldaşın",
  description:
    "Sınav hazırlığında seni anlayan, devam ettiren ve yalnız bırakmayan AI koç + topluluk.",
};

/**
 * Root layout — sets html lang from next-intl middleware, injects fonts and global CSS.
 * Locale-specific providers (NextIntlClientProvider, AuthProvider, BackgroundBlobs)
 * live in [locale]/layout.tsx.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // getLocale() throws outside the [locale] segment (e.g. the global /_not-found
  // route, which has no request locale during static prerender) — fall back to the
  // default locale for the <html lang> there.
  let locale: string = routing.defaultLocale;
  try {
    locale = await getLocale();
  } catch {
    /* no request locale (global not-found / static prerender) → default */
  }
  return (
    <html lang={locale} className={`${heading.variable} ${body.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body
          attributes pre-hydration; this silences only attribute diffs on <body>. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
