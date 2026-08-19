import type { InkToolId } from "@/lib/notebook-ink";

/**
 * The pens themselves, drawn rather than iconified.
 *
 * Procedural SVG with no raster asset, the same rule `notebook-surface.tsx` follows for the paper,
 * the spiral and the cover — the notebook's whole look is drawn in the browser, and a set of PNG
 * pens would be the one thing in it that could not follow the colour it is currently loaded with.
 *
 * That is the point of the artwork over a line icon: each pen shows the ink it will lay down, so
 * the toolbar answers "what happens if I draw now" without a legend. `lucide` has a `Pencil` and a
 * `Highlighter` and nothing that distinguishes a marker from a fineliner from a fountain nib.
 *
 * Every pen is drawn tip-down in a 28×88 box so the row can lift the selected one straight up.
 * Body colours are literal, like `INK_PALETTE`: these are objects lying on a dark tray, not themed
 * surfaces — a barrel that inverted in dark mode would stop reading as a pen.
 */

const BODY = "#3f434c";
const BODY_LIGHT = "#585d69";
const BODY_DARK = "#2a2d34";
const METAL = "#b9bec9";
const METAL_DARK = "#8d94a1";
const WOOD = "#d9b98a";
const WOOD_DARK = "#bd9a68";
const GOLD = "#d8a441";

export interface PenArtProps {
  /** The ink this pen is currently loaded with — tips and bands pick it up. */
  color: string;
}

/** The lengthwise highlight every barrel shares. Sells the round body more than shading does. */
function Gloss({ x, y, height, width = 2.5 }: { x: number; y: number; height: number; width?: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={width / 2} fill={BODY_LIGHT} opacity={0.75} />;
}

function Pencil({ color }: PenArtProps) {
  return (
    <>
      {/* Hexagonal barrel, faceted with two tone bands rather than a gradient. */}
      <path d="M8 6h12v58H8z" fill={BODY} />
      <path d="M17 6h3v58h-3z" fill={BODY_DARK} />
      <Gloss x={9.5} y={9} height={52} />
      {/* Sharpened wood cone, then the graphite point in the current ink. */}
      <path d="M8 64h12l-6 12z" fill={WOOD} />
      <path d="M14 64h6l-6 12z" fill={WOOD_DARK} />
      <path d="M11.6 70.8h4.8L14 76z" fill={color} />
      {/* Ferrule and eraser cap — what makes it read as a pencil at a glance. */}
      <rect x="8" y="6" width="12" height="5" fill={METAL} />
      <path d="M8 2.5A2.5 2.5 0 0 1 10.5 0h7A2.5 2.5 0 0 1 20 2.5V6H8z" fill="#e8877f" />
    </>
  );
}

function Pen({ color }: PenArtProps) {
  return (
    <>
      <path d="M8.5 4h11v56h-11z" fill={BODY} />
      <path d="M16.5 4h3v56h-3z" fill={BODY_DARK} />
      <Gloss x={10} y={7} height={50} />
      {/* Clip. */}
      <path d="M19.5 8h2.5v16a1.2 1.2 0 0 1-2.5 0z" fill={METAL_DARK} />
      <rect x="8.5" y="0" width="11" height="4" rx="1.5" fill={BODY_DARK} />
      {/* Metal cone down to the ball, which carries the ink colour. */}
      <path d="M8.5 60h11l-4 12h-3z" fill={METAL} />
      <path d="M15 60h4.5l-4 12h-1.5z" fill={METAL_DARK} />
      <path d="M12.5 72h3l-1.5 4z" fill={color} />
    </>
  );
}

function Fineliner({ color }: PenArtProps) {
  return (
    <>
      {/* Slimmest barrel of the set — the silhouette is the whole tell. */}
      <path d="M10 4h8v58h-8z" fill={BODY} />
      <path d="M15.5 4h2.5v58h-2.5z" fill={BODY_DARK} />
      <Gloss x={11} y={7} height={52} width={2} />
      <rect x="10" y="0" width="8" height="4" rx="1.2" fill={color} />
      {/* Stepped plastic collar, then a needle tip of constant width. */}
      <path d="M10 62h8l-1.5 6h-5z" fill={BODY_DARK} />
      <rect x="12.8" y="68" width="2.4" height="9" rx="1.2" fill={color} />
    </>
  );
}

function Marker({ color }: PenArtProps) {
  return (
    <>
      {/* Fattest barrel, squared shoulders. */}
      <path d="M5.5 6h17v52h-17z" fill={BODY} />
      <path d="M17 6h5.5v52H17z" fill={BODY_DARK} />
      <Gloss x={7.5} y={9} height={46} width={3} />
      <rect x="5.5" y="1" width="17" height="5" rx="1.5" fill={color} />
      {/* Shoulder into a broad chisel — cut on the slant, which is what a marker leaves. */}
      <path d="M5.5 58h17l-2.5 6h-12z" fill={BODY_DARK} />
      <path d="M8 64h12l1.5 12H9z" fill={color} />
      <path d="M9 76h12.5l-1-8H9z" fill={color} opacity={0.55} />
    </>
  );
}

function Highlighter({ color }: PenArtProps) {
  return (
    <>
      {/* The one pen whose whole body is the ink — a highlighter is bought by its colour. */}
      <path d="M5.5 8h17v50h-17z" fill={color} />
      <path d="M17 8h5.5v50H17z" fill="#000000" opacity={0.16} />
      <rect x="7.5" y="11" width="3" height="44" rx="1.5" fill="#ffffff" opacity={0.45} />
      {/* Translucent cap ring — the see-through window real highlighters have. */}
      <rect x="5.5" y="2" width="17" height="6" rx="2" fill="#ffffff" opacity={0.35} />
      <path d="M5.5 58h17l-2 6h-13z" fill="#000000" opacity={0.22} />
      {/* Broad chisel, wider than the marker's: this one is meant to cover a whole line. */}
      <path d="M7 64h14l2 13H5z" fill={color} />
      <path d="M5 77h18l-1.5-6H6.5z" fill="#000000" opacity={0.12} />
    </>
  );
}

function Brush({ color }: PenArtProps) {
  return (
    <>
      <path d="M9 2h10v52H9z" fill={BODY} />
      <path d="M16 2h3v52h-3z" fill={BODY_DARK} />
      <Gloss x={10.5} y={5} height={46} />
      {/* Crimped metal ferrule holding the bristles. */}
      <path d="M8 54h12v8H8z" fill={METAL} />
      <path d="M15 54h5v8h-5z" fill={METAL_DARK} />
      <rect x="8" y="56.5" width="12" height="1.4" fill={METAL_DARK} opacity={0.7} />
      {/* Bristles: a belly that comes to a point, the shape that makes the stroke taper. */}
      <path d="M9.5 62c0 6 1 11 4.5 16 3.5-5 4.5-10 4.5-16z" fill={color} />
      <path d="M14 62c0 6 0 11 0 16 3.5-5 4.5-10 4.5-16z" fill="#000000" opacity={0.18} />
    </>
  );
}

function Fountain({ color }: PenArtProps) {
  return (
    <>
      <path d="M8.5 2h11v50h-11z" fill={BODY} />
      <path d="M16.5 2h3v50h-3z" fill={BODY_DARK} />
      <Gloss x={10} y={5} height={44} />
      <path d="M19.5 6h2.5v15a1.2 1.2 0 0 1-2.5 0z" fill={GOLD} />
      {/* Gold band at the section joint. */}
      <rect x="8.5" y="52" width="11" height="5" fill={GOLD} />
      <rect x="8.5" y="54.6" width="11" height="1.2" fill="#000000" opacity={0.2} />
      {/* The nib: shoulders, a breather hole, and the slit that splits the tines. */}
      <path d="M9.5 57h9l-1 11-3.5 8-3.5-8z" fill={GOLD} />
      <path d="M14 57h4.5l-1 11-3.5 8z" fill="#000000" opacity={0.18} />
      <circle cx="14" cy="62" r="1.6" fill={BODY_DARK} />
      <path d="M13.4 64h1.2l.4 12h-2z" fill={color} />
    </>
  );
}

function Eraser() {
  return (
    <>
      {/* No ink, so no colour prop: an eraser that tinted itself would promise something it
          cannot do. Bevelled corner and a paper sleeve, which is the whole silhouette. */}
      <path d="M6 26h16v42a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" fill="#f0a8a0" />
      <path d="M16 26h6v42a4 4 0 0 1-4 4h-2z" fill="#d98d85" />
      <path d="M6 26l5-9a3 3 0 0 1 2.4-1.2h1.2A3 3 0 0 1 17 17l5 9z" fill="#f6c2bc" />
      <rect x="5" y="34" width="18" height="13" rx="1.5" fill="#e9edf2" />
      <rect x="5" y="34" width="18" height="3" fill="#cdd4de" />
      <rect x="16" y="34" width="7" height="13" fill="#000000" opacity={0.08} />
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
  /** Rendered height in px; the box is 28×88, so width follows at roughly a third. */
  size?: number;
}) {
  const Art = PENS[tool];
  return (
    <svg
      viewBox="0 0 28 88"
      height={size}
      width={(size * 28) / 88}
      // The button around it carries the accessible name; the drawing itself says nothing extra.
      aria-hidden
      focusable="false"
    >
      <Art color={color} />
    </svg>
  );
}
