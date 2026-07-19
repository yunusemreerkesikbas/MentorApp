import { setRequestLocale } from "next-intl/server";
import { ManageShell } from "./_components/manage-shell";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ManageShell slug={slug} />;
}
