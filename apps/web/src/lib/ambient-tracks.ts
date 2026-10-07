import type { StudyRoomTheme } from "@mentor/types";

/**
 * Client-side ambient catalog for /study-session (no backend).
 *
 * Every theme sounds like its room: the place's own ambience with a quiet music bed under it.
 * `scene` follows whichever room is on screen; a theme id pins that room's sound.
 */
export const AMBIENT_TRACK_IDS = ["scene", "library", "cafe", "home", "off"] as const;

export type AmbientTrackId = (typeof AMBIENT_TRACK_IDS)[number];

/** Two loops played together; they differ in length, so the mix never repeats the same way. */
export interface AmbientLayers {
  ambience: string;
  music: string;
}

/** Files under `apps/web/public/audio` (sources and licences: `public/audio/README.md`). */
export const AMBIENT_THEME_LAYERS: Record<StudyRoomTheme, AmbientLayers> = {
  LIBRARY: {
    ambience: "/audio/scene-library-ambience.mp3",
    music: "/audio/scene-library-music.mp3",
  },
  CAFE: {
    ambience: "/audio/scene-cafe-ambience.mp3",
    music: "/audio/scene-cafe-music.mp3",
  },
  HOME: {
    ambience: "/audio/scene-home-ambience.mp3",
    music: "/audio/scene-home-music.mp3",
  },
};

const PINNED_THEME: Partial<Record<AmbientTrackId, StudyRoomTheme>> = {
  library: "LIBRARY",
  cafe: "CAFE",
  home: "HOME",
};

/** Ids the previous catalog stored; someone who had sound on keeps it, now following the scene. */
const LEGACY_TRACK_IDS = ["soft", "rain", "warm"];

export function isAmbientTrackId(value: string): value is AmbientTrackId {
  return (AMBIENT_TRACK_IDS as readonly string[]).includes(value);
}

export function migrateAmbientTrackId(value: string): AmbientTrackId | null {
  if (isAmbientTrackId(value)) return value;
  return LEGACY_TRACK_IDS.includes(value) ? "scene" : null;
}

/** The loops a track plays in the room on screen, or null for silence. */
export function ambientLayers(
  trackId: AmbientTrackId,
  sceneTheme: StudyRoomTheme,
): AmbientLayers | null {
  if (trackId === "off") return null;
  return AMBIENT_THEME_LAYERS[PINNED_THEME[trackId] ?? sceneTheme];
}
