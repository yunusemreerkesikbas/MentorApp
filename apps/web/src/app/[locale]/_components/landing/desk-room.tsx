import type { CSSProperties } from "react";
import { WOOD_BROAD, WOOD_FINE } from "@/components/notebook-desk/desk-backdrop";

/**
 * The vector part of the "Sabah masası" scene: the Defterlerim desk in its day theme, redrawn on a
 * fixed 1040 × 520 stage. Colours are the day tokens of `notebook-desk.css`; the wood is the same
 * generated grain tile. Everything that carries words is HTML on top (`desk-scene.tsx`), so it
 * wraps and translates. Two SVGs because the wood between them is an HTML layer of tiles.
 */

/** A box on the stage, in stage units (1040 wide); `.ld-at` turns them into lengths. */
export function at(x: number, y: number, w: number, h?: number): CSSProperties {
  return { "--x": x, "--y": y, "--w": w, ...(h === undefined ? {} : { "--h": h }) } as CSSProperties;
}

export function DeskWall() {
  return (
    <svg className="ld-room" viewBox="0 0 1040 520" aria-hidden="true">
      <defs>
        <linearGradient id="ld-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9e3f1" />
          <stop offset=".7" stopColor="#f2ece4" />
          <stop offset="1" stopColor="#efe5d8" />
        </linearGradient>
        <pattern id="ld-dots" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="14" r="1.4" fill="rgba(150,110,60,.12)" />
        </pattern>
        <linearGradient id="ld-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fcaf7" />
          <stop offset=".7" stopColor="#c9e7fd" />
          <stop offset="1" stopColor="#eaf6ff" />
        </linearGradient>
        <linearGradient id="ld-wall-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3c1e" stopOpacity="0" />
          <stop offset="1" stopColor="#5a3c1e" stopOpacity=".22" />
        </linearGradient>
        <filter id="ld-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <clipPath id="ld-glass">
          <rect x="482" y="0" width="156" height="150" />
        </clipPath>
      </defs>
      <rect width="1040" height="234" fill="url(#ld-wall)" />
      <rect width="1040" height="234" fill="url(#ld-dots)" />
      <rect x="470" y="-14" width="180" height="176" rx="4" fill="#8a6a4f" />
      <g clipPath="url(#ld-glass)">
        <rect x="482" y="0" width="156" height="150" fill="url(#ld-sky)" />
        <circle cx="584" cy="45" r="44" fill="#fff0be" opacity=".75" filter="url(#ld-glow)" />
        <circle cx="584" cy="45" r="27" fill="#fff7d8" />
        <g fill="#fff" opacity=".95">
          <rect x="496" y="40" width="70" height="19" rx="9.5" />
          <circle cx="523" cy="37" r="13" />
          <circle cx="546" cy="45" r="9" />
          <rect x="566" y="80" width="49" height="13" rx="6.5" />
          <circle cx="585" cy="78" r="9" />
        </g>
        <ellipse cx="516" cy="146" rx="59" ry="52" fill="#8dbf8a" />
        <ellipse cx="605" cy="150" rx="64" ry="48" fill="#a9d1a0" />
        <rect x="556" y="0" width="8" height="150" fill="#8a6a4f" />
        <rect x="482" y="62" width="156" height="8" fill="#8a6a4f" />
      </g>
      <rect x="458" y="158" width="204" height="15" rx="3" fill="#8a6a4f" />
      <rect y="146" width="1040" height="64" fill="url(#ld-wall-shade)" />
      {/* The goal board's nail and cord; the framed board itself is HTML (`BoardFrame`). */}
      <path d="M692 40 770 14 848 40" fill="none" stroke="#9b7b55" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="770" cy="14" r="3.4" fill="#8a6a4f" />
    </svg>
  );
}

/** The desk top: the notebook desk's own grain tiles, scaled with the stage. */
export function DeskWood() {
  return (
    <div className="ld-wood" aria-hidden="true">
      <div className="ld-grain" style={{ backgroundImage: WOOD_BROAD, "--grain": 0.45, "--tile-w": 900, "--tile-h": 520 } as CSSProperties} />
      <div className="ld-grain" style={{ backgroundImage: WOOD_FINE, "--grain": 0.55, "--tile-w": 640, "--tile-h": 420 } as CSSProperties} />
    </div>
  );
}

export function DeskObjects() {
  return (
    <svg className="ld-room" viewBox="0 0 1040 520" aria-hidden="true">
      <defs>
        <linearGradient id="ld-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8e2" stopOpacity=".95" />
          <stop offset=".55" stopColor="#ffeec8" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffe8be" stopOpacity=".1" />
        </linearGradient>
        <filter id="ld-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* The window laid on the wood as a patch of sun. */}
      <polygon points="440,224 642,224 561,424 359,424" fill="url(#ld-sun)" opacity=".55" filter="url(#ld-soft)" className="ld-sunpatch" />
      {/* The lamp, switched off for the day. */}
      <ellipse cx="986" cy="302" rx="46" ry="11" fill="#000" opacity=".25" filter="url(#ld-soft)" />
      <ellipse cx="986" cy="298" rx="44" ry="10" fill="#3a4258" />
      <path d="M986 296 960 150 910 124" fill="none" stroke="#3d4560" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="960" cy="150" r="6" fill="#a7aec0" />
      <g transform="translate(900 132) rotate(-32)">
        <path d="M-18 -20 L18 -20 L32 18 L-32 18 Z" fill="#3b4566" />
        <ellipse cx="0" cy="18" rx="32" ry="6" fill="#56618a" />
        <ellipse cx="0" cy="19" rx="18" ry="3.5" fill="#d9d4c6" />
      </g>
      {/* Mug and plant on the back edge. */}
      <ellipse cx="420" cy="216" rx="22" ry="5" fill="#000" opacity=".22" filter="url(#ld-soft)" />
      <path d="M436 192c12 0 12 16 0 16" fill="none" stroke="#f1e9dc" strokeWidth="5" />
      <rect x="402" y="184" width="36" height="31" rx="5" fill="#f1e9dc" />
      <rect x="402" y="196" width="36" height="5" fill="#8ec1f4" />
      <ellipse cx="420" cy="185" rx="18" ry="4" fill="#fbf6ee" />
      <ellipse cx="420" cy="185.5" rx="14" ry="2.6" fill="#3b2416" />
      <path className="ld-steam" d="M414 176c-4-6 4-9 0-16M425 176c-4-6 4-9 0-16" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="682" cy="217" rx="22" ry="5" fill="#000" opacity=".2" filter="url(#ld-soft)" />
      <path d="M682 186c-14-22-8-40-2-48M682 186c-2-20 8-38 18-44M682 186c-14-12-22-26-20-36M682 186c8-14 22-20 30-20" fill="none" stroke="#3f8a5a" strokeWidth="6" strokeLinecap="round" />
      <path d="M666 184h32l-4 32h-24z" fill="#c8693f" />
      <rect x="663" y="181" width="38" height="7" rx="2" fill="#d77c50" />
      {/* Puhu's book stack, as on Defterlerim (he is an image on top). */}
      <g transform="translate(178 64) scale(.78)">
        <ellipse cx="95" cy="222" rx="96" ry="8" fill="#000" opacity=".42" filter="url(#ld-soft)" />
        <rect x="4" y="188" width="182" height="32" rx="5" fill="#7a3333" />
        <rect x="4" y="197" width="182" height="5" fill="#ffdca0" opacity=".35" />
        <rect x="16" y="160" width="162" height="29" rx="5" fill="#2c6461" />
        <rect x="16" y="180" width="162" height="4" fill="#ffe6b4" opacity=".32" />
        <rect x="28" y="134" width="144" height="27" rx="5" fill="#b8873a" />
        <rect x="28" y="141" width="144" height="4" fill="#5a320a" opacity=".35" />
        <ellipse cx="100" cy="137" rx="46" ry="5" fill="#000" opacity=".3" filter="url(#ld-soft)" />
      </g>
      {/* A pencil. */}
      <g transform="rotate(-18 640 330)">
        <rect x="596" y="326" width="86" height="8" rx="1" fill="#f2c230" />
        <rect x="588" y="326" width="10" height="8" rx="2" fill="#f2a3b0" />
        <path d="M682 326l12 4-12 4z" fill="#f3dcb4" />
        <path d="M690 329l4 1-4 1z" fill="#333" />
      </g>
    </svg>
  );
}
