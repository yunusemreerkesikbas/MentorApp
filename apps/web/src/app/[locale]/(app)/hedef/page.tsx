import { setRequestLocale } from "next-intl/server";
import { HedefShell } from "./_components/hedef-shell";

/** Vision/goal board edit page — reached from the panel card (not a nav tab). */
export default async function HedefPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HedefShell />;
}
