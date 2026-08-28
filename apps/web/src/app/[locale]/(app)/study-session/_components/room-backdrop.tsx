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
  /**
   * Which artwork 404'd, BY SOURCE. A single `visualFailed` boolean was the last copy of a bug
   * already fixed in `RoomSeats` and the theme carousel: stepping onto a theme whose art has
   * not shipped flipped it, and stepping back never flipped it off — so the library came back
   * with no ground until something remounted this component. Keyed by src, a theme that has
   * art is unaffected by one that does not, and a failed src is never re-requested.
   */
  const [failedSrc, setFailedSrc] = useState<readonly string[]>([]);
  const src = STUDY_ROOM_BACKDROP_SRC[theme];

  return (
    // Self-scoping: focus mode renders this inside `.session-focus-theme`, so the room token
    // family has to travel with the component rather than rely on an ancestor.
    // `aria-hidden` only removes this from the a11y tree — it does not stop the browser's
    // hit-test, so without `pointer-events-none` this full-bleed decorative stack would sit in
    // front of (or tie-break above, on equal z-index) every floating control on the stage.
    <div
      aria-hidden
      className="room-stage pointer-events-none absolute inset-0 overflow-hidden"
      data-room-theme={theme}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 8%, var(--room-ground-from) 0%, var(--room-ground-to) 100%)",
        }}
      />
      {failedSrc.includes(src) ? null : (
        <Image
          src={src}
          alt=""
          fill
          // Eager: this is the ground, not content. Lazy-loading would both pop the artwork in
          // late and leave `onError` unreachable while the file is missing (the request is
          // never made), so the fallback would never actually run.
          priority
          sizes="100vw"
          className="object-cover"
          onError={() => setFailedSrc((prev) => (prev.includes(src) ? prev : [...prev, src]))}
        />
      )}
      {/* `veilPercent` scales the theme's OWN veil rather than mixing its ground colour: a
          light room and a dark room need opposite veils, and one shared percentage of
          `--room-ground-to` gave the light one a bleach bath. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--room-veil)", opacity: veilPercent / 100 }}
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
