import type { CSSProperties } from "react";
import { CAMERA_KEYS } from "./city-camera";
import { FRONT_LIFT_TALL, LAYER_DEPTHS, type SceneArt } from "./city-scene";
import { SceneImg } from "./scene-img";

/** CSS paints the same opening camera while the interactive stage is still hydrating. */
export function CityArt({ art, layer, priority }: { art: SceneArt; layer: number; priority?: boolean }) {
  const opening: Record<string, number | string> = {
    "--lc-art-left": `${art.left}px`,
    "--lc-art-top": `${art.top}px`,
    "--lc-art-width": `${art.width}px`,
  };
  for (const layout of ["tall", "wide"] as const) {
    const [x, y, zoom, ax, ay] = CAMERA_KEYS[layout][0];
    const depth = LAYER_DEPTHS[layer];
    const scale = 1 + (zoom - 1) * depth;
    const lift = layer === 3 && layout === "tall" ? FRONT_LIFT_TALL : 0;
    opening[`--lc-${layout}-x`] = (art.left - 1200 - (x - 800) * depth) * scale;
    opening[`--lc-${layout}-y`] = (art.top - 560 - (y - 560) * depth + lift) * scale;
    opening[`--lc-${layout}-width`] = art.width * scale;
    opening[`--lc-${layout}-ax`] = ax;
    opening[`--lc-${layout}-ay`] = ay;
  }
  return <SceneImg className="lc-art" src={art.src} width={art.naturalWidth} height={art.naturalHeight}
    fetchPriority={priority ? "high" : undefined} style={opening as CSSProperties} />;
}
