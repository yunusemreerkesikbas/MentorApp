"use client";

import { useState } from "react";
import Image from "next/image";
import type { StudyRoomTheme } from "@mentor/types";
import { STUDY_ROOM_BACKDROP_SRC, STUDY_ROOM_GROUND } from "@/lib/study-room-theme";

/**
 * The room's ground: the approved illustration for the theme when it is present, the token
 * ground otherwise. Same shape as {@link SessionFocusBackdrop} — `next/image` with an
 * `onError` fallback — so a missing or slow artwork file degrades to a calm colour wash
 * instead of a blank rectangle, and dropping the file in later needs no code change.
 *
 * The illustrations are deliberately furniture-free in the centre: the table and its seats are
 * DOM, because their count changes per room.
 */
export function RoomBackdrop({
  theme,
  /** Veil strength over the artwork. Higher keeps UI legible when the timer sits on top. */
  veilPercent = 34,
}: {
  theme: StudyRoomTheme;
  veilPercent?: number;
}) {
  const [visualFailed, setVisualFailed] = useState(false);
  const { ground } = STUDY_ROOM_GROUND[theme];

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: ground }} />
      {visualFailed ? null : (
        <Image
          src={STUDY_ROOM_BACKDROP_SRC[theme]}
          alt=""
          fill
          // Eager: this is the ground, not content. Lazy-loading would both pop the artwork in
          // late and leave `onError` unreachable while the file is missing (the request is
          // never made), so the fallback below would never actually run.
          priority
          sizes="100vw"
          className="object-cover"
          onError={() => setVisualFailed(true)}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `color-mix(in srgb, var(--color-bg) ${veilPercent}%, transparent)`,
        }}
      />
    </div>
  );
}
