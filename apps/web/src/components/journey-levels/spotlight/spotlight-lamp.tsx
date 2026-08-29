"use client";

import { useId } from "react";
import { motion, type MotionValue, useTransform } from "framer-motion";

import { beamAngleDeg, beamThrowFalloff } from "./spotlight-choreography";

/*
 * The cone is drawn with a conic gradient, not `clip-path`.
 *
 * Two earlier attempts failed for the same reason: CSS applies clipping *after* filtering, so a
 * `clip-path` triangle keeps a razor silhouette no matter how much blur sits on it. The blur only
 * softened the interior, which is exactly what made the core and the penumbra read as two hard
 * triangles nested inside one another. An angular gradient has no edge to begin with — the wedge
 * simply fades out sideways — so the two layers blend into one volume.
 *
 * `from` points at the wedge's leading edge and the stops sweep across it, keeping the shape
 * symmetric about straight down without wrapping through 0°.
 *
 * Three values that look like details and are not:
 *
 * `at 50% -22%` lifts the apex well above the element. A conic origin near the edge converges to a
 * point, so the beam leaves the fixture as a thin stalk and visibly pinches before it widens — a
 * real lens emits at its own width. The offset is sized so the wedge is roughly lens-wide by the
 * time it reaches the glass.
 *
 * The bright band is held across a range of angles rather than peaking at a single stop: a conic
 * gradient concentrates its peak on one ray, so a single-stop peak reads far dimmer than the flat
 * triangle it replaced even at the same nominal alpha.
 *
 * The alphas are high (58% core) for the same reason — they are peak-of-a-ray values, not the
 * fill of a shape.
 */
const CORE_WEDGE =
  "conic-gradient(from 164deg at 50% -22%, transparent 0deg, color-mix(in srgb, var(--spotlight-beam) 10%, transparent) 5deg, color-mix(in srgb, var(--spotlight-beam) 50%, transparent) 11deg, color-mix(in srgb, var(--spotlight-beam) 58%, transparent) 16deg, color-mix(in srgb, var(--spotlight-beam) 50%, transparent) 21deg, color-mix(in srgb, var(--spotlight-beam) 10%, transparent) 27deg, transparent 32deg)";
const PENUMBRA_WEDGE =
  "conic-gradient(from 146deg at 50% -22%, transparent 0deg, color-mix(in srgb, var(--spotlight-penumbra) 3%, transparent) 8deg, color-mix(in srgb, var(--spotlight-penumbra) 20%, transparent) 22deg, color-mix(in srgb, var(--spotlight-penumbra) 24%, transparent) 34deg, color-mix(in srgb, var(--spotlight-penumbra) 20%, transparent) 46deg, color-mix(in srgb, var(--spotlight-penumbra) 3%, transparent) 60deg, transparent 68deg)";

/** Distance falloff, shared by both wedges: carries most of the way, then dissolves at the floor. */
const THROW_MASK =
  "radial-gradient(ellipse 120% 100% at 50% 0%, #000 0%, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.72) 80%, transparent 100%)";

interface SpotlightLampProps {
  /** 0..1 across the stage. Written by the scene from the sweep, the pointer or a drag. */
  lightX: MotionValue<number>;
  /** The rig has descended and may be seen. Before this the stage is simply dark. */
  visible: boolean;
  /** The lamp is switched on — bulb, beam and floor pool come up. */
  lit: boolean;
  dropMs: number;
}

/**
 * Cable, fixture and beam are one rig pivoting at the ceiling anchor, so a single rotation moves
 * all three and the lit pool on the floor follows for free. Rotation only — nothing repaints
 * per frame.
 *
 * The fixture is inline SVG rather than an image: it has to tilt with the rig, its lens has to
 * react to `lit`, and its metal has to come from the scoped theme tokens. A bitmap would need a
 * sprite sheet and separate glow layers to do the same three things.
 */
export function SpotlightLamp({ lightX, visible, lit, dropMs }: SpotlightLampProps) {
  /* Goes through the tested helper on purpose: the sign convention is the part that breaks. */
  const angle = useTransform(lightX, (x) => beamAngleDeg(x));
  /* Swinging the rig lengthens the throw, so the cone dims. Tested helper, same as the angle. */
  const throwFalloff = useTransform(lightX, (x) => beamThrowFalloff(x));
  const gradientId = useId();
  const bodyGradient = `${gradientId}-body`;
  const ringGradient = `${gradientId}-ring`;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-0 z-10 h-full origin-top will-change-transform"
      style={{ rotate: angle, x: "-50%" }}
      initial={{ y: "-30%", opacity: 0 }}
      animate={{ y: visible ? 0 : "-30%", opacity: visible ? 1 : 0 }}
      transition={
        dropMs > 0
          ? {
              y: { type: "spring", stiffness: 90, damping: 13, mass: 1.1 },
              opacity: { duration: dropMs / 2000, ease: "easeOut" },
            }
          : { duration: 0 }
      }
    >
      <svg
        viewBox="0 0 200 150"
        className="absolute left-1/2 top-0 h-[150px] w-[200px] -translate-x-1/2 overflow-visible"
      >
        <defs>
          <linearGradient id={bodyGradient} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0b0c10" />
            <stop offset="34%" stopColor="#3a3f4b" />
            <stop offset="62%" stopColor="#22262f" />
            <stop offset="100%" stopColor="#0b0c10" />
          </linearGradient>
          <linearGradient id={ringGradient} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#191c23" />
            <stop offset="45%" stopColor="#59606f" />
            <stop offset="100%" stopColor="#191c23" />
          </linearGradient>
        </defs>

        {/* cable + clamp */}
        <line x1="100" y1="0" x2="100" y2="30" stroke="#4a4f5b" strokeWidth="2" />
        <rect x="92" y="28" width="16" height="9" rx="2.5" fill="#3a3f4b" />

        {/* yoke */}
        <path
          d="M74 44v34M126 44v34M74 46a26 26 0 0 1 52 0"
          fill="none"
          stroke="#4a4f5b"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* housing — wider at the lens end, like a fresnel seen head on */}
        <path
          d="M78 42h44l14 56H64Z"
          fill={`url(#${bodyGradient})`}
          stroke="#0a0b0e"
          strokeWidth="1.5"
        />
        {/* ribs */}
        <path
          d="M80 56h40M79 68h42M77 80h46"
          stroke="#0e1015"
          strokeWidth="1.5"
          opacity="0.75"
        />

        {/* barn doors */}
        <path
          d="M64 98 46 84v16Z M136 98l18-14v16Z"
          fill="#23262e"
          stroke="#0a0b0e"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* lens rim + glass */}
        <ellipse cx="100" cy="98" rx="38" ry="8" fill={`url(#${ringGradient})`} />
        <motion.ellipse
          cx="100"
          cy="98"
          rx="30"
          ry="5.5"
          fill="var(--spotlight-beam)"
          animate={{ opacity: lit ? 1 : 0.06 }}
          transition={{ duration: 0.25 }}
        />
        <motion.ellipse
          cx="100"
          cy="98"
          rx="30"
          ry="5.5"
          fill="var(--spotlight-beam)"
          className="blur-md"
          animate={{ opacity: lit ? 0.9 : 0 }}
          transition={{ duration: 0.35 }}
        />
      </svg>

      {/* Beam. Two wedges, not one: a wide cool penumbra and a narrow warm core, so the light has
          a bright centre falling off through haze rather than one flat tone. Both live inside the
          rig, so the swing costs a single rotation for the pair. See the note above the wedge
          constants for why neither uses `clip-path`. */}
      <motion.div
        className="absolute left-1/2 top-[96px] -translate-x-1/2"
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* A modest blur only dithers the conic banding; the softness itself comes from the
            gradient, so this no longer has a silhouette to fight. */}
        <motion.span
          className="absolute left-1/2 top-0 h-[70vh] w-[150vw] -translate-x-1/2 blur-[12px]"
          style={{
            opacity: throwFalloff,
            background: PENUMBRA_WEDGE,
            maskImage: THROW_MASK,
            WebkitMaskImage: THROW_MASK,
          }}
        />
        <motion.span
          className="absolute left-1/2 top-0 h-[68vh] w-[150vw] -translate-x-1/2 blur-[6px]"
          style={{
            opacity: throwFalloff,
            background: CORE_WEDGE,
            maskImage: THROW_MASK,
            WebkitMaskImage: THROW_MASK,
          }}
        />
      </motion.div>

      {/* Halo right at the lens, where a real fixture spills the most. */}
      <motion.span
        className="absolute left-1/2 top-[96px] size-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--spotlight-beam) 26%, transparent), transparent 68%)",
        }}
      />
    </motion.div>
  );
}
