import "./weekly-chest.css";

const ART = {
  closed: "/visuals/chest/chest-closed.webp",
  open: "/visuals/chest/chest-open.webp",
} as const;

type Strip = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The lock plate (Puhu's glasses), where the lamps flow before the lid opens. */
  lock?: { x: number; y: number };
  /** Picture height / width, so a lamp stays round on a wide picture. */
  aspect?: number;
};

/** Where the brass strip sits on each picture, as fractions of the art (measured on the files). */
const STRIPS = {
  icon: { left: 0.241, right: 0.748, top: 0.656, bottom: 0.74 },
  desk: { left: 0.333, right: 0.667, top: 0.838, bottom: 0.893, lock: { x: 0.5, y: 0.768 } },
  deskWide: { left: 0.414, right: 0.576, top: 0.801, bottom: 0.851, lock: { x: 0.496, y: 0.739 }, aspect: 720 / 1280 },
  deskTall: { left: 0.346, right: 0.661, top: 0.766, bottom: 0.802, lock: { x: 0.507, y: 0.723 }, aspect: 1280 / 720 },
} satisfies Record<string, Strip>;

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
  const box: Strip = STRIPS[strip];
  const width = box.right - box.left;
  const size = (box.bottom - box.top) * 0.62 * (box.aspect ?? 1);
  const lock = box.lock ?? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {lamps.map((lit, index) => (
        <span
          key={index}
          className="wc-lamp"
          data-lit={lit}
          data-flow={flowing}
          style={{
            left: pct(flowing ? lock.x : box.left + ((index + 0.5) / lamps.length) * width),
            top: pct(flowing ? lock.y : (box.top + box.bottom) / 2),
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
