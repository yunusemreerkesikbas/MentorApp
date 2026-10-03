import type { Ref } from "react";

/**
 * The desk lamp, in the 420 × 420 drawing space `use-desk-light.ts` aims it in.
 *
 * Only its head moves, turned by `--desk-lamp-turn` towards whichever notebook is under the hand.
 * At night the bulb glows and the pool and cone in the backdrop do the lighting; by day the bulb
 * is a dull shade and the window lights the desk instead.
 */

/** Pivot of the head and the rim of the shade, in the lamp's own drawing units. */
export const LAMP_ART = {
  size: 420,
  pivot: { x: 130, y: 110 },
  /** The two ends of the shade's mouth, at rest. The cone of light starts between them. */
  mouth: [
    { x: 24.5, y: 149.5 },
    { x: 101.7, y: 219.1 },
  ],
  /** Direction the shade points at rest, in degrees (screen coordinates, y down). */
  restAngle: 132,
  maxTurn: 22,
} as const;

export function DeskLamp({
  lampRef,
  className,
}: {
  lampRef?: Ref<SVGSVGElement>;
  className?: string;
}) {
  return (
    <svg
      ref={lampRef}
      className={`desk-lamp ${className ?? ""}`}
      viewBox="0 0 420 420"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <ellipse cx="330" cy="408" rx="84" ry="14" fill="#000" opacity="0.45" style={{ filter: "blur(5px)" }} />
      <path className="metal" d="M252 404 Q252 386 330 384 Q408 386 408 404 Q408 418 330 420 Q252 418 252 404 Z" />
      <path d="M262 398 Q300 390 330 390 Q360 390 398 398" stroke="#fff" strokeOpacity="0.16" strokeWidth="3" fill="none" />
      <rect className="joint" x="321" y="368" width="18" height="24" rx="4" />
      <path className="arm" d="M330 378 L272 172" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M322 352 L282 212" stroke="#fff" strokeOpacity="0.18" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle className="joint" cx="272" cy="172" r="12" />
      <path className="arm" d="M272 172 L130 110" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M256 162 L148 115" stroke="#fff" strokeOpacity="0.16" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <g className="desk-lamp-head">
        <circle className="joint" cx="130" cy="110" r="11" />
        <path className="shade" d="M112.3 110.2 L131.7 127.6 L100.2 217.8 L25.9 150.8 Z" />
        <path d="M112.3 110.2 L25.9 150.8" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle className="shade" cx="122" cy="118.9" r="13" />
        <ellipse className="rim" cx="63.1" cy="184.3" rx="52" ry="14" transform="rotate(42 63.1 184.3)" />
        <ellipse className="bulb" cx="63.1" cy="184.3" rx="46" ry="10.5" transform="rotate(42 63.1 184.3)" />
        <ellipse
          className="glow"
          cx="63.1"
          cy="184.3"
          rx="40"
          ry="16"
          transform="rotate(42 63.1 184.3)"
          fill="#ffd98f"
          style={{ filter: "blur(9px)" }}
        />
      </g>
    </svg>
  );
}
