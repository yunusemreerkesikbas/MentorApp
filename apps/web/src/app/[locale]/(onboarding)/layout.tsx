import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { OnboardingGuard } from "./_components/onboarding-guard";

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OnboardingGuard>{children}</OnboardingGuard>;
}
