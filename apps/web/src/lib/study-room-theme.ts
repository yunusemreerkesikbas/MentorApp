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

/** Approved backdrop illustration per theme. Missing files fall back to the token ground. */
export const STUDY_ROOM_BACKDROP_SRC: Record<StudyRoomTheme, string> = {
  LIBRARY: "/visuals/room-library-bg.webp",
  CAFE: "/visuals/room-cafe-bg.webp",
  HOME: "/visuals/room-home-bg.webp",
};

export function isStudyRoomTheme(value: string): value is StudyRoomTheme {
  return (STUDY_ROOM_THEME_IDS as readonly string[]).includes(value);
}
