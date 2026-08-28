import type { StudyRoomTheme } from "@mentor/types";
import type { AmbientTrackId } from "@/lib/ambient-tracks";

/**
 * Client-side room constants. The API is the authority on the bounds (enforced in
 * `@mentor/validation`); they are mirrored here only so the create form can render sane inputs.
 */
export const STUDY_ROOM_THEME_IDS: readonly StudyRoomTheme[] = ["LIBRARY", "CAFE", "HOME"];

export const STUDY_ROOM_CAPACITY_MIN = 2;
export const STUDY_ROOM_CAPACITY_MAX = 10;
/** Four seats — a friend group, and a table that doesn't look empty with two people at it. */
export const STUDY_ROOM_CAPACITY_DEFAULT = 4;

/**
 * Default ambient track per theme, reusing the tracks the session screen already ships — a
 * library sounds like `soft`, a café like `warm`, a home like `rain`. Seeds the first
 * impression only; the moment the user touches the ambient picker their choice sticks.
 */
export const STUDY_ROOM_AMBIENT: Record<StudyRoomTheme, AmbientTrackId> = {
  LIBRARY: "soft",
  CAFE: "warm",
  HOME: "rain",
};

/**
 * Room artwork lives in its own folder rather than the flat `/visuals` drop (whose README asks
 * for no subfolders): this is nine files that only make sense as a set — a theme is a backdrop
 * AND a table AND a chair, and adding a fourth theme adds three more. Every path below is
 * `/img/seans-theme/room-{theme}-{part}.webp`; that naming is what lets a new theme ship as
 * three files and no code change.
 */
const ROOM_ART_DIR = "/img/seans-theme";

/** Approved backdrop illustration per theme. Missing files fall back to the token ground. */
export const STUDY_ROOM_BACKDROP_SRC: Record<StudyRoomTheme, string> = {
  LIBRARY: `${ROOM_ART_DIR}/room-library-bg.webp`,
  CAFE: `${ROOM_ART_DIR}/room-cafe-bg.webp`,
  HOME: `${ROOM_ART_DIR}/room-home-bg.webp`,
};

/**
 * Approved table illustration per theme: a single top-down, capacity-agnostic asset scaled
 * by CSS rather than swapped per seat count. Missing files fall back to the CSS-drawn ellipse
 * `RoomSeats` already renders, same graceful-degradation shape as the backdrop above.
 */
export const STUDY_ROOM_TABLE_SRC: Record<StudyRoomTheme, string> = {
  LIBRARY: `${ROOM_ART_DIR}/room-library-table.webp`,
  CAFE: `${ROOM_ART_DIR}/room-cafe-table.webp`,
  HOME: `${ROOM_ART_DIR}/room-home-table.webp`,
};

/**
 * Approved chair illustration per theme. Deliberately radially symmetric from directly above
 * (no visible armrests or a directional backrest) — the SAME image is reused, unrotated, at
 * every position around the table, so one asset covers every capacity from 2 to 10.
 */
export const STUDY_ROOM_SEAT_SRC: Record<StudyRoomTheme, string> = {
  LIBRARY: `${ROOM_ART_DIR}/room-library-seat.webp`,
  CAFE: `${ROOM_ART_DIR}/room-cafe-seat.webp`,
  HOME: `${ROOM_ART_DIR}/room-home-seat.webp`,
};

/**
 * Cut-to-black when you sit down at a table, and the fade-up on the session screen you land
 * on. Both ends read this one number, so the curtain never lifts before it has finished
 * falling. Lives here rather than in either screen — importing it from the other would pull
 * that whole page into this one's bundle for the sake of one integer.
 */
export const ROOM_CURTAIN_MS = 280;

export function isStudyRoomTheme(value: string): value is StudyRoomTheme {
  return (STUDY_ROOM_THEME_IDS as readonly string[]).includes(value);
}
