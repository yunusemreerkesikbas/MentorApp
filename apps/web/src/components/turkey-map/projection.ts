import { MAP_PROJECTION, type ProvinceShape } from "./paths.generated";

/**
 * Spherical Mercator forward transform, matching the `geoMercator` that generated the province
 * paths. Four lines instead of a ~30KB d3-geo bundle — and `build-turkey-map.mjs` asserts this
 * formula against d3's own output at generation time, so the two cannot silently drift apart.
 *
 * Returns coordinates in the same viewBox space as `ProvinceShape.d`.
 */
export function projectLngLat(
  longitude: number,
  latitude: number,
): { x: number; y: number } {
  const { scale, translateX, translateY } = MAP_PROJECTION;
  const lambda = (longitude * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  return {
    x: scale * lambda + translateX,
    y: translateY - scale * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  };
}

/**
 * viewBox string that frames one province, with a margin so the shape does not touch the edges.
 * Falls back to the whole country when the province has no geometry (empty placeholder data).
 */
export function provinceViewBox(
  shape: ProvinceShape | undefined,
  fallback: string,
  padRatio = 0.12,
): string {
  if (!shape) return fallback;
  const [x0, y0, x1, y1] = shape.bbox;
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return fallback;

  const pad = Math.max(width, height) * padRatio;
  return `${x0 - pad} ${y0 - pad} ${width + pad * 2} ${height + pad * 2}`;
}
