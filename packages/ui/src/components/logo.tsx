import type * as React from "react";

export interface LogoProps {
  /**
   * Which drawing (DESIGN.md §8.7): `large` at 24px and up, `small` below it, where the eye
   * grows, the letters open up and the glint drops out so the pupil still reads.
   * The type size comes from the caller's classes.
   */
  cut?: "small" | "large";
  className?: string;
}

/* The o of Koç is an eye in a 100-unit box: the ring's stroke is Nunito 1000's stem, the pupil
   sits tangent to it looking up and ahead (DESIGN.md §8.7). */
const CUTS = {
  large: { eye: "0.52em", tracking: "-0.03em", pupil: { cx: 54.56, cy: 45.44, r: 15.05 }, glint: true },
  small: { eye: "0.56em", tracking: "0.005em", pupil: { cx: 55.78, cy: 44.22, r: 13.33 }, glint: false },
} as const;

/** The PuhuKoç wordmark (DESIGN.md §8.7). Server-safe; ink and pupil follow the theme. */
export function Logo({ cut = "small", className }: LogoProps) {
  const c = CUTS[cut];
  return (
    <span
      role="img"
      aria-label="PuhuKoç"
      className={`whitespace-nowrap ${className ?? ""}`}
      style={{ fontFamily: "var(--font-heading)", fontWeight: 1000, letterSpacing: c.tracking }}
    >
      PuhuK
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: c.eye,
          height: c.eye,
          margin: "0 0.03em -0.01em 0.02em",
          verticalAlign: "baseline",
          overflow: "visible",
        }}
      >
        <circle cx="50" cy="50" r="35.75" fill="none" stroke="currentColor" strokeWidth="28.5" />
        <circle cx={c.pupil.cx} cy={c.pupil.cy} r={c.pupil.r} style={{ fill: "var(--logo-pupil)" }} />
        {c.glint ? (
          <circle cx="59.72" cy="40.28" r="3.87" style={{ fill: "var(--logo-glint)" }} />
        ) : null}
      </svg>
      ç
    </span>
  );
}
