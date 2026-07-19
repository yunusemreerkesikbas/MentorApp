/** Client-side ambient catalog for /study-session (no backend). */
export const AMBIENT_TRACK_IDS = ["off", "soft", "rain", "warm"] as const;

export type AmbientTrackId = (typeof AMBIENT_TRACK_IDS)[number];

export interface AmbientTrackDefinition {
  id: AmbientTrackId;
  /** Public URL under `apps/web/public`, or null for silent. */
  src: string | null;
}

export const AMBIENT_TRACKS: readonly AmbientTrackDefinition[] = [
  { id: "off", src: null },
  { id: "soft", src: "/audio/focus-ambient-soft.wav" },
  { id: "rain", src: "/audio/focus-ambient-rain.wav" },
  { id: "warm", src: "/audio/focus-ambient-warm.wav" },
] as const;

export function isAmbientTrackId(value: string): value is AmbientTrackId {
  return (AMBIENT_TRACK_IDS as readonly string[]).includes(value);
}

export function ambientTrackSrc(trackId: AmbientTrackId): string | null {
  return AMBIENT_TRACKS.find((t) => t.id === trackId)?.src ?? null;
}
