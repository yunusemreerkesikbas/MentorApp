import { setRequestLocale } from "next-intl/server";
import { BoardEditorShell } from "./_components/board-editor-shell";

/** Collage editor for the goal set on `/hedef`. Optional — the goal works without a board. */
export default async function VisionBoardCollagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BoardEditorShell />;
}
