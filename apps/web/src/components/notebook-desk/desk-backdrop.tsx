/**
 * The room behind the notebooks: wall, window and the wooden desk.
 *
 * Purely decorative and fully static: everything that moves here is CSS (twinkling stars, dust in
 * the lamp's cone, the pool of light gliding to whichever book is under the hand) and everything
 * that changes with the theme is a token in `notebook-desk.css`. Both skies are always in the DOM
 * and cross-fade on the theme class, so toggling the theme lamp turns the window from day to night
 * in place instead of remounting the scene.
 */

/** A seeded stream so stars and dust land in the same places on the server and the client. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const random = seededRandom(11);
const STARS = Array.from({ length: 16 }, () => ({
  left: `${(4 + random() * 88).toFixed(1)}%`,
  top: `${(4 + random() * 46).toFixed(1)}%`,
  delay: `${(random() * 3).toFixed(2)}s`,
}));
const VILLAGE_LIGHTS = [
  ["16%", "72%"],
  ["20%", "75%"],
  ["31%", "69%"],
  ["60%", "78%"],
  ["69%", "75%"],
  ["80%", "80%"],
] as const;

const MOTES = Array.from({ length: 36 }, () => ({
  left: `${(random() * 100).toFixed(1)}%`,
  top: `${(4 + random() * 60).toFixed(1)}%`,
  size: `${(2 + random() * 3).toFixed(1)}px`,
  duration: `${(5 + random() * 5).toFixed(2)}s`,
  delay: `${(-random() * 9).toFixed(2)}s`,
}));

/**
 * Wood grain as a tile, generated rather than fetched — the same trick as the cover materials.
 *
 * Tiled with `stitchTiles` instead of one turbulence stretched over the desk: the desk grows with
 * the number of notebooks, and a single filter over a page-tall rect is both re-rasterised on every
 * resize and stretched out of shape. A tile rasterises once and repeats.
 */
function woodTile(
  width: number,
  height: number,
  frequency: string,
  octaves: number,
  seed: number,
  matrix: string,
): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><filter id='w' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='matrix' values='${matrix}'/></filter><rect width='100%' height='100%' filter='url(#w)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Long dark streaks: the fine grain. */
const WOOD_FINE = woodTile(
  640,
  420,
  "0.0035 0.1",
  4,
  3,
  "0 0 0 0 0.09  0 0 0 0 0.05  0 0 0 0 0.02  2.2 0 0 0 -0.95",
);
/** Broad pale bands: the figure of the board. */
const WOOD_BROAD = woodTile(
  900,
  520,
  "0.0022 0.045",
  2,
  8,
  "0 0 0 0 0.86  0 0 0 0 0.62  0 0 0 0 0.42  0 1.8 0 0 -0.82",
);

/**
 * The light in the room, drawn over the notebooks rather than behind them.
 *
 * Over, because a lamp lights what lies under it: the pool brightens the cover of the book it
 * rests on, not only the wood around it. Screen-blended layers, each with its own z-index, inside
 * containers that do not form stacking contexts, so every layer blends with the whole scene below
 * it and not just with an empty group of its own. The page's header sits above all of it.
 */
export function DeskLight() {
  return (
    <div className="desk-light" aria-hidden="true">
      <div className="desk-day-only" style={{ position: "absolute", inset: 0 }}>
        <div className="desk-shaft" />
      </div>
      <div className="desk-night-only" style={{ position: "absolute", inset: 0 }}>
        <div className="desk-pool" />
        <div className="desk-cone" />
        <div className="desk-motes">
          {MOTES.map((mote) => (
            <i
              key={`${mote.left}-${mote.top}`}
              className="desk-mote"
              style={{
                left: mote.left,
                top: mote.top,
                width: mote.size,
                height: mote.size,
                animationDuration: mote.duration,
                animationDelay: mote.delay,
              }}
            />
          ))}
        </div>
        <div className="desk-moonwash" />
      </div>
      <div className="desk-vignette" />
    </div>
  );
}

export function DeskBackdrop() {
  return (
    <div className="desk-backdrop" aria-hidden="true">
      <div className="desk-wall" />
      <div className="desk-window">
        <div className="desk-day-only" style={{ position: "absolute", inset: 0 }}>
          <span className="desk-sun" />
          <span className="desk-cloud" style={{ left: "10%", top: "26%" }} />
          <span
            className="desk-cloud"
            style={{ left: "50%", top: "50%", transform: "scale(0.7)" }}
          />
        </div>
        <div className="desk-night-only" style={{ position: "absolute", inset: 0 }}>
          {STARS.map((star) => (
            <span
              key={`${star.left}-${star.top}`}
              className="desk-star"
              style={{ left: star.left, top: star.top, animationDelay: star.delay }}
            />
          ))}
          <span className="desk-moon" />
        </div>
        <span
          className="desk-hill"
          style={{
            left: "-16%",
            top: "62%",
            width: "76%",
            height: "70%",
            background: "var(--desk-hill-far)",
          }}
        />
        <span
          className="desk-hill"
          style={{
            left: "38%",
            top: "68%",
            width: "82%",
            height: "64%",
            background: "var(--desk-hill-near)",
          }}
        />
        <div className="desk-night-only" style={{ position: "absolute", inset: 0 }}>
          {VILLAGE_LIGHTS.map(([left, top]) => (
            <span
              key={`${left}-${top}`}
              className="desk-village-light"
              style={{ left, top }}
            />
          ))}
        </div>
        <span className="desk-window-mullion-v" />
        <span className="desk-window-mullion-h" />
      </div>
      <div className="desk-sill" />
      <div className="desk-wall-shade" />

      <div className="desk-wood">
        <div
          className="desk-wood-grain"
          data-grain="broad"
          style={{ backgroundImage: WOOD_BROAD }}
        />
        <div
          className="desk-wood-grain"
          data-grain="fine"
          style={{ backgroundImage: WOOD_FINE }}
        />
        <div className="desk-wood-edge" />
      </div>

      <div className="desk-day-only" style={{ position: "absolute", inset: 0 }}>
        <div className="desk-sunpatch">
          <div className="desk-sunpatch-panes" />
        </div>
      </div>
    </div>
  );
}
