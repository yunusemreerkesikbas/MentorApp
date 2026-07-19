import { setRequestLocale } from "next-intl/server";
import { VisionBoardShell } from "./_components/vision-board-shell";

/** Vision/goal board edit page — reached from the panel card (not a nav tab). */
export default async function VisionBoardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VisionBoardShell />;
}
