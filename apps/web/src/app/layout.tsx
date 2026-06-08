import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
