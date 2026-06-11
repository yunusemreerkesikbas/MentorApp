import type { Metadata } from "next";
import { Lato, League_Spartan } from "next/font/google";
import { BackgroundBlobs } from "@mentor/ui";
import { AuthProvider } from "../lib/auth-context";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${heading.variable} ${body.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body
          attributes pre-hydration; this silences only attribute diffs on <body>. */}
      <body suppressHydrationWarning>
        <BackgroundBlobs />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
