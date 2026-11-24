import { Audio } from "@remotion/media";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import { SOUND } from "../art";

// The music bed baked into a reel: starts on the track's drop (8,0 s), short fade in, 1 s fade out at the end.
export const MUSIC_DROP_S = 8;
// Per-track gain, measured on the rendered mp4s 2026-11-21: Igloo 0.85 and Balkan 1.0 both peak near -4 dBFS,
// RMS Igloo ~-14.7, Balkan ~-18 dBFS (Balkan is the flatter, quieter mix and has no more headroom).
export const REEL_MUSIC_VOLUME = { reelIgloo: 0.85, reelBalkan: 1 } as const;

export function reelMusicVolume(track: Track, frame: number, fps: number, durationInFrames: number): number {
  const v = REEL_MUSIC_VOLUME[track];
  return interpolate(frame, [0, 0.15 * fps, durationInFrames - fps, durationInFrames - 1], [0, v, v, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

type Track = keyof typeof REEL_MUSIC_VOLUME;

export function ReelMusic({ track }: { track: Track }) {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Audio name="Müzik" src={staticFile(SOUND[track])} trimBefore={MUSIC_DROP_S * fps} volume={(f) => reelMusicVolume(track, f, fps, durationInFrames)} />
  );
}
