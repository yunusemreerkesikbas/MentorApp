import "./weekly-chest.css";

const ART = {
  closed: "/visuals/chest/chest-closed.webp",
  open: "/visuals/chest/chest-open.webp",
} as const;

/** Where the brass strip sits on each picture, as fractions of the square art (measured on the files). */
const STRIPS = {
  icon: { left: 0.241, right: 0.748, top: 0.656, bottom: 0.74 },
  desk: { left: 0.333, right: 0.667, top: 0.838, bottom: 0.893 },
} as const;
/** The lock plate (Puhu's glasses) on the desk picture, where the lamps flow before the lid opens. */
const DESK_LOCK = { x: 0.5, y: 0.768 };

const pct = (fraction: number) => `${fraction * 100}%`;

/**
 * One lamp per target day on the chest's brass strip, drawn in code so the count follows the config
 * target. On the desk picture the lamps can flow into the lock (`flowing`).
 */
export function ChestLamps({
  lamps,
  strip,
  flowing = false,
}: {
  lamps: boolean[];
  strip: keyof typeof STRIPS;
  flowing?: boolean;
}) {
  const box = STRIPS[strip];
  const width = box.right - box.left;
  const size = (box.bottom - box.top) * 0.62;
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {lamps.map((lit, index) => (
        <span
          key={index}
          className="wc-lamp"
          data-lit={lit}
          data-flow={flowing}
          style={{
            left: pct(flowing ? DESK_LOCK.x : box.left + ((index + 0.5) / lamps.length) * width),
            top: pct(flowing ? DESK_LOCK.y : (box.top + box.bottom) / 2),
            width: pct(size),
            transitionDelay: flowing ? `${index * 30}ms` : undefined,
          }}
        />
      ))}
    </span>
  );
}

/** The chest picture (closed with its lamps, or open), square, sized by `className`. */
export function ChestArt({
  open,
  lamps,
  className = "",
}: {
  open: boolean;
  lamps?: boolean[];
  className?: string;
}) {
  return (
    <span className={`relative block aspect-square shrink-0 ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- small local webp, sized by its parent; the lamps sit on it in percent */}
      <img
        src={open ? ART.open : ART.closed}
        alt=""
        decoding="async"
        draggable={false}
        className="size-full select-none object-contain"
      />
      {!open && lamps ? <ChestLamps lamps={lamps} strip="icon" /> : null}
    </span>
  );
}
