import { REEL_CENTRE } from "../brand";
import { SIZES, type Format } from "../pieces";

// Insets that platform UI covers (spec: "Brand and format constraints").
const INSETS: Record<Format, { l: number; t: number; r: number; b: number }> = {
  feed: { l: 56, t: 56, r: 56, b: 56 },
  landscape: { l: 48, t: 48, r: 48, b: 48 },
  story: { l: 0, t: 250, r: 0, b: 250 },
  reel: { l: 60, t: 250, r: 180, b: 420 },
};

const BAND = "rgba(255, 0, 0, 0.28)";

export function SafeZones({ format, show }: { format: Format; show: boolean }) {
  if (!show) return null;
  const { width, height } = SIZES[format];
  const { l, t, r, b } = INSETS[format];
  const band = (left: number, top: number, w: number, h: number) => (
    <div style={{ position: "absolute", left, top, width: w, height: h, background: BAND, pointerEvents: "none" }} />
  );
  return (
    <>
      {band(0, 0, width, t)}
      {band(0, height - b, width, b)}
      {band(0, t, l, height - t - b)}
      {/* Reels: the right rail only covers the lower part of the frame. */}
      {format === "reel" ? band(width - r, REEL_CENTRE.railFrom, r, height - REEL_CENTRE.railFrom - b) : band(width - r, t, r, height - t - b)}
    </>
  );
}
