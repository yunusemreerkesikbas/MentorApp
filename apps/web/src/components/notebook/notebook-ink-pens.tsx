import { useId } from "react";
import type { InkToolId } from "@/lib/notebook-ink";

/**
 * The pens themselves, drawn rather than iconified — a second pass after the first draft read as
 * thin, flat sticks lost in a lot of empty padding. Two things changed:
 *
 * 1. **Tip up, not tip down.** The first draft drew every pen tip-first toward the bottom of its
 *    box, which buried the interesting, chunky part (the barrel) and left the thin, uninteresting
 *    part (the point) as the only thing with room to read. A pen standing in a cup — the reference
 *    the design was built against — plants its barrel on the tray floor and lets the tip rise. That
 *    single flip is most of why the second pass reads as heavier and more present than the first.
 * 2. **The barrel fills most of its box width**, not a third of it, and carries a two-stop gradient
 *    plus a thin glass-like highlight strip instead of one flat fill — enough dimensionality to read
 *    as a rounded cylinder at 44px without building a full faceted-gradient system for eight icons
 *    that mostly get glanced at, not studied.
 *
 * Procedural SVG with no raster asset, same rule `notebook-surface.tsx` follows for the paper, the
 * spiral and the cover. Every pen shares one barrel silhouette (rounded shoulders, flat foot) so the
 * row reads as one family; only the top ~third — the tip, cap or nib — is tool-specific, and that is
 * also the one part that shows the current ink colour. The barrel stays a neutral material (wood,
 * cream plastic, dark plastic, steel, gold) exactly like a real pen's barrel does regardless of what
 * colour is loaded in it — recolouring the whole body would make the tray look like it changes
 * material every time the student picks a different colour, not just ink.
 */

const VIEW_W = 30;
const VIEW_H = 64;

/** Shared by every barrelled tool; the eraser is its own single block and skips this. */
const BARREL_X0 = 5;
const BARREL_X1 = 25;
const BARREL_Y0 = 25;
const BARREL_Y1 = 64;
const BARREL_RX = 4;

interface BarrelTone {
  dark: string;
  base: string;
  light: string;
  /** The thin ferrule band just under the tip. Defaults to a shade of `dark`. */
  collar?: string;
}

const TONE = {
  wood: { dark: "#a9793f", base: "#c9944f", light: "#f0c07a" },
  cream: { dark: "#c9c6bd", base: "#e9e6de", light: "#ffffff" },
  charcoal: { dark: "#1c1e22", base: "#33363c", light: "#53565f" },
  steel: { dark: "#7d838f", base: "#a6acb8", light: "#e3e7ee" },
} as const satisfies Record<string, BarrelTone>;

/** The gold a nib is made of — fixed, not ink-tinted: the metal doesn't change colour, the ink does. */
const NIB_GOLD = { dark: "#8a651c", base: "#c99a3a", light: "#f3d885" };

/**
 * A pen's lower body: gradient-filled barrel, a glassy highlight strip, and a darker collar band
 * where the tip/cap meets it. `uid` keeps this instance's gradient ids from colliding with the
 * seven other pens rendered alongside it in the open tray.
 */
function Barrel({ uid, tone }: { uid: string; tone: BarrelTone }) {
  const gradId = `barrel-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1={BARREL_X0} x2={BARREL_X1} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tone.dark} />
          <stop offset="0.42" stopColor={tone.base} />
          <stop offset="0.58" stopColor={tone.light} />
          <stop offset="1" stopColor={tone.dark} />
        </linearGradient>
      </defs>
      <path
        d={`M${BARREL_X0} ${BARREL_Y0 + BARREL_RX}
            a${BARREL_RX} ${BARREL_RX} 0 0 1 ${BARREL_RX} -${BARREL_RX}
            h${BARREL_X1 - BARREL_X0 - BARREL_RX * 2}
            a${BARREL_RX} ${BARREL_RX} 0 0 1 ${BARREL_RX} ${BARREL_RX}
            V${BARREL_Y1} H${BARREL_X0} Z`}
        fill={`url(#${gradId})`}
      />
      {/* Glassy highlight — the one cue that sells "rounded plastic" over "flat card". */}
      <rect
        x={BARREL_X0 + 3.5}
        y={BARREL_Y0 + 5}
        width={2.2}
        height={BARREL_Y1 - BARREL_Y0 - 9}
        rx={1.1}
        fill="#ffffff"
        opacity={0.32}
      />
      {/* Collar: the ferrule where the tip/cap seats into the barrel. */}
      <rect
        x={BARREL_X0}
        y={BARREL_Y0}
        width={BARREL_X1 - BARREL_X0}
        height={3.5}
        fill={tone.collar ?? tone.dark}
        opacity={0.85}
      />
    </>
  );
}

export interface PenArtProps {
  /** The ink this pen is currently loaded with — the tip/cap/nib picks it up, the barrel does not. */
  color: string;
  uid: string;
}

function Pencil({ color, uid }: PenArtProps) {
  // A hexagonal cone: three facets (dark/light/mid) so it reads as faceted wood, not a flat triangle.
  return (
    <>
      <Barrel uid={uid} tone={TONE.wood} />
      <path d={`M${BARREL_X0} ${BARREL_Y0} L15 4 L12 ${BARREL_Y0} Z`} fill={TONE.wood.dark} />
      <path d={`M12 ${BARREL_Y0} L15 4 L18 ${BARREL_Y0} Z`} fill={TONE.wood.light} />
      <path d={`M18 ${BARREL_Y0} L15 4 L${BARREL_X1} ${BARREL_Y0} Z`} fill={TONE.wood.base} />
      {/* Graphite point, in the loaded ink colour. */}
      <path d="M13 9 L15 1 L17 9 Z" fill={color} />
    </>
  );
}

function Pen({ color, uid }: PenArtProps) {
  return (
    <>
      <Barrel uid={uid} tone={TONE.cream} />
      <path d={`M${BARREL_X0} ${BARREL_Y0} L15 6 L${BARREL_X1} ${BARREL_Y0} Z`} fill={TONE.cream.base} />
      <path d={`M11 ${BARREL_Y0} L15 6 L15 ${BARREL_Y0} Z`} fill={TONE.cream.light} opacity={0.7} />
      {/* Ball tip. */}
      <circle cx="15" cy="7" r="2.3" fill={color} />
    </>
  );
}

function Fineliner({ color, uid }: PenArtProps) {
  // The thinnest silhouette of the set on purpose — a fineliner's whole identity is "not fat".
  return (
    <>
      <Barrel uid={uid} tone={TONE.charcoal} />
      <rect x="13.2" y="6" width="3.6" height={BARREL_Y0 - 6} fill={TONE.charcoal.base} />
      <rect x="13.2" y="6" width="1.4" height={BARREL_Y0 - 6} fill={TONE.charcoal.light} opacity={0.6} />
      <path d="M13.2 6 L15 1.5 L16.8 6 Z" fill={TONE.charcoal.dark} />
      {/* The ink cartridge collar — this pen's stand-in for a coloured tip. */}
      <rect x="11.5" y={BARREL_Y0 - 4} width="7" height="4" fill={color} />
    </>
  );
}

function Marker({ color, uid }: PenArtProps) {
  return (
    <>
      <Barrel uid={uid} tone={TONE.charcoal} />
      <path
        d={`M7 ${BARREL_Y0} L${BARREL_X1 - 2} ${BARREL_Y0} L21 11 L9 11 Z`}
        fill={TONE.charcoal.base}
      />
      {/* The chisel nib, just visible above the cap — this is where ink colour shows. */}
      <path d="M9 11 L21 11 L19.5 8 L10.5 8 Z" fill={color} />
    </>
  );
}

function Highlighter({ color, uid }: PenArtProps) {
  // The one tool whose whole cap is the ink colour: a highlighter's chisel is most of what you see
  // of it, so colouring only a sliver (like the marker's nib) would make it look uncoloured.
  return (
    <>
      <Barrel uid={uid} tone={TONE.charcoal} />
      <path d={`M6 ${BARREL_Y0} L${BARREL_X1} ${BARREL_Y0} L22 6 L9 10 Z`} fill={color} />
      <path d={`M6 ${BARREL_Y0} L${BARREL_X1} ${BARREL_Y0} L24 ${BARREL_Y0 - 4} L5 ${BARREL_Y0 - 4} Z`} fill="#ffffff" opacity={0.18} />
    </>
  );
}

function Brush({ color, uid }: PenArtProps) {
  return (
    <>
      <Barrel uid={uid} tone={TONE.cream} />
      <rect x="8" y="18" width="14" height="7" rx="1" fill={`url(#barrel-${uid})`} />
      <rect x="8" y="18" width="14" height="1.4" fill={TONE.steel.light} opacity={0.7} />
      {/* Bristle cone: a soft, slightly uneven taper rather than a sharp point. */}
      <path d="M8.5 19 C9 12 12 6 15 2 C18 6 21 12 21.5 19 Z" fill={color} />
      <path d="M15 2 C13.5 7 12.5 13 12.5 19 L15 19 Z" fill="#000000" opacity={0.14} />
    </>
  );
}

function Fountain({ color, uid }: PenArtProps) {
  return (
    <>
      <Barrel uid={uid} tone={TONE.charcoal} />
      <path d={`M${BARREL_X0} ${BARREL_Y0} L15 6 L${BARREL_X1} ${BARREL_Y0} Z`} fill={TONE.charcoal.base} />
      {/* The nib — fixed gold, the one thing on this pen that never takes the ink colour. */}
      <path d="M12 15 L15 2 L18 15 L15 21 Z" fill={NIB_GOLD.base} />
      <path d="M12 15 L15 2 L15 21 Z" fill={NIB_GOLD.light} opacity={0.6} />
      <line x1="15" y1="7" x2="15" y2="17" stroke={NIB_GOLD.dark} strokeWidth="0.6" />
      <circle cx="15" cy="9.5" r="0.9" fill={NIB_GOLD.dark} />
      {/* Section/grip ring: the one place ink colour peeks through on this tool. */}
      <rect x="11.5" y={BARREL_Y0 - 4.5} width="7" height="4.5" fill={color} />
    </>
  );
}

function Eraser() {
  // No `color` — an eraser leaves no ink, so there is nothing for it to preview.
  return (
    <>
      <path
        d={`M6 18 a4 4 0 0 1 4 -4 h10 a4 4 0 0 1 4 4 V${VIEW_H} H6 Z`}
        fill="#f0a8a0"
      />
      <rect x="6" y="18" width="18" height="2.4" fill="#ffffff" opacity={0.3} />
      <rect x="6" y="30" width="18" height="9" fill="#e9edf2" />
      <rect x="6" y="30" width="18" height="2" fill="#cdd4de" />
      <rect x="9" y="21" width="1.8" height="34" fill="#ffffff" opacity={0.25} />
    </>
  );
}

const PENS: Record<InkToolId, (props: PenArtProps) => React.ReactElement> = {
  pencil: Pencil,
  pen: Pen,
  fineliner: Fineliner,
  marker: Marker,
  highlighter: Highlighter,
  brush: Brush,
  fountain: Fountain,
  eraser: Eraser,
};

export function InkPenArt({
  tool,
  color,
  size = 60,
}: {
  tool: InkToolId;
  color: string;
  /** Rendered height in px; the box is 30×64, so width follows at just under half that. */
  size?: number;
}) {
  const uid = useId();
  const Art = PENS[tool];
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      height={size}
      width={(size * VIEW_W) / VIEW_H}
      // The button around it carries the accessible name; the drawing itself says nothing extra.
      aria-hidden
      focusable="false"
    >
      <Art color={color} uid={uid} />
    </svg>
  );
}
