import type { CSSProperties } from "react";

/** Twelve puffs in a ring, flattened onto the desk: what a book raises when it lands. */
const PUFFS = Array.from({ length: 12 }, (_, index) => ({
  angle: index * 30 + ((index * 7) % 18),
  delay: (index * 37) % 90,
  size: 6 + ((index * 5) % 9),
}));

export function DeskDust() {
  return (
    <div className="desk-dust" aria-hidden="true">
      {PUFFS.map((puff) => (
        <span key={puff.angle} style={{ transform: `rotate(${puff.angle}deg)` }}>
          <i
            style={
              {
                width: puff.size,
                height: puff.size,
                "--delay": `${puff.delay}ms`,
              } as CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}
