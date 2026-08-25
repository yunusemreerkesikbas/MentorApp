import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { AuthShell } from "./_components/auth-shell";

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthShell>{children}</AuthShell>;
}
