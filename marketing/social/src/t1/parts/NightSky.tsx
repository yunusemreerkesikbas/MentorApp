import { Img, staticFile, useCurrentFrame } from "remotion";
import { ART } from "../../art";

// The app's "Şehrin üstünde" night (plan-coach-stage.css `.plan-coach-night`, its CSS px ×2.77 for a
// 1080 px frame): starry sky, the landing's three city layers along the bottom, drifting slowly apart.
// The dark stop sits lower than the app's 50% so Puhu's clip disc (ground #0E0F26) never shows an edge.
const STARS = [
  [11, 15, 4], [88, 11, 3], [79, 32, 3.4], [20, 41, 3], [50, 4, 3], [69, 20, 3.6], [33, 25, 3],
  [6, 52, 2.6], [94, 46, 2.6], [58, 37, 2.4], [42, 9, 2.4], [25, 6, 2.2],
] as const;
const CITY_H = 806;
const CITY_W = 1209;

export function NightSky() {
  const frame = useCurrentFrame();
  const layer = (src: string, bottom: number, x: number, drift: number) => (
    <Img src={staticFile(src)} alt="" style={{ position: "absolute", left: (1080 - CITY_W) / 2 + x, bottom, width: CITY_W, height: CITY_H, translate: `${-drift * frame}px 0` }} />
  );
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(to bottom, #0D0E25 0%, #0D0E25 64%, #132552 82%, #1B3563 100%)" }}>
      {STARS.map(([x, y, r]) => (
        <div key={`${x}-${y}`} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, borderRadius: "50%", background: "#FFFFFF", opacity: 0.6, boxShadow: `0 0 ${r * 3}px rgba(255, 255, 255, 0.7)` }} />
      ))}
      {layer(ART.t1CityFar, 0, 0, 0.12)}
      {layer(ART.t1CityMid, -72, 55, 0.25)}
      {layer(ART.t1CityFront, -110, 0, 0.4)}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "linear-gradient(to bottom, rgba(5, 12, 30, 0), rgba(5, 12, 30, 0.78))" }} />
    </div>
  );
}
