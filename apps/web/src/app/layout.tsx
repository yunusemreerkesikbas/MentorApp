import type { Metadata } from "next";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

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
    <html lang="tr">
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject body
          attributes pre-hydration; this silences only attribute diffs on <body>. */}
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
