import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mentor Admin",
  description: "İç yönetim paneli — yalnız ekip (Cloudflare Access arkası).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      {/* suppressHydrationWarning: browser extensions inject body attributes pre-hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
