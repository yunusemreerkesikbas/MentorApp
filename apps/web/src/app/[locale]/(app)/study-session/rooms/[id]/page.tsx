import { Suspense } from "react";
import { setRequestLocale } from "@/i18n/locale";
import { RoomShell } from "../../_components/room-shell";
import { RoomStageSkeleton } from "../../_components/room-stage-skeleton";

/** `/seans/masa/[id]` — the shared table: seats, live presence, and the invite code. */
export default async function StudyRoomPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  // Suspense for `useSearchParams` (the invite arrival flag); the fallback is the stage itself.
  return (
    <Suspense fallback={<RoomStageSkeleton />}>
      <RoomShell roomId={id} />
    </Suspense>
  );
}
