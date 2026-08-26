"use client";

import { useState } from "react";
import Image from "next/image";
import type { StudyRoomTheme } from "@mentor/types";
import { STUDY_ROOM_BACKDROP_SRC } from "@/lib/study-room-theme";

/**
 * The room's ground: a theme wash always, with the approved illustration layered over it when
 * the file exists. Same `onError` shape as {@link SessionFocusBackdrop}, so a missing artwork
 * degrades to the wash instead of a blank rectangle and dropping the file in later needs no
 * code change.
 *
 * Colours come from the scoped `--room-*` family, not app tokens: the stage is a place, and a
 * café stays dim whether or not the reader has dark mode on.
 */
export function RoomBackdrop({
  theme,
  /** Veil over the artwork. Higher keeps floating chrome legible on a busy illustration. */
  veilPercent = 26,
}: {
  theme: StudyRoomTheme;
  veilPercent?: number;
}) {
  const [visualFailed, setVisualFailed] = useState(false);

  return (
    // Self-scoping: focus mode renders this inside `.session-focus-theme`, so the room token
    // family has to travel with the component rather than rely on an ancestor.
    <div
      aria-hidden
      className="room-stage absolute inset-0 overflow-hidden"
      data-room-theme={theme}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 8%, var(--room-ground-from) 0%, var(--room-ground-to) 100%)",
        }}
      />
      {visualFailed ? null : (
        <Image
          src={STUDY_ROOM_BACKDROP_SRC[theme]}
          alt=""
          fill
          // Eager: this is the ground, not content. Lazy-loading would both pop the artwork in
          // late and leave `onError` unreachable while the file is missing (the request is
          // never made), so the fallback would never actually run.
          priority
          sizes="100vw"
          className="object-cover"
          onError={() => setVisualFailed(true)}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `color-mix(in srgb, var(--room-ground-to) ${veilPercent}%, transparent)`,
        }}
      />
      {/* Vignette: pulls the eye to the table and darkens the edges the chrome floats over. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 45%, transparent 40%, color-mix(in srgb, var(--room-table-edge) 22%, transparent) 100%)",
        }}
      />
    </div>
  );
}
