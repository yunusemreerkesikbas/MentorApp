import { setRequestLocale } from "next-intl/server";
import { SubscriptionShell } from "./_components/subscription-shell";

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SubscriptionShell />;
}
