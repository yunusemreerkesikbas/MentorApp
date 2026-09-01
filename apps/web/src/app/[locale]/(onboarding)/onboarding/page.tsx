import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import { OnboardingWizard } from "../_components/onboarding-wizard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OnboardingWizard />;
}
