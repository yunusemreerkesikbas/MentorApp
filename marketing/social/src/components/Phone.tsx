import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { ART } from "../art";
import { PHONE, screenMatrix } from "../phone-matrix";

// The 3D phone. `screen` is drawn in a 378×822 box mapped into the render's screen hole;
// `popOut` uses the same mapping but sits above the phone, unclipped, so art can burst out.
export function Phone({
  width,
  screen,
  popOut,
  screenBg,
  style,
}: {
  width: number;
  screen: ReactNode;
  popOut?: ReactNode;
  screenBg: string;
  style?: CSSProperties;
}) {
  const height = Math.round((width * PHONE.height) / PHONE.width); // 470 → 922, 1000 → 1962 as in the canvas
  const layer: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: PHONE.screenWidth,
    height: PHONE.screenHeight,
    transformOrigin: "0 0",
    transform: screenMatrix(width),
  };
  return (
    <div style={{ position: "absolute", width, height, ...style }}>
      <div style={{ ...layer, borderRadius: PHONE.radius, overflow: "hidden", background: screenBg }}>{screen}</div>
      <Img src={staticFile(ART.phone)} alt="" style={{ position: "absolute", left: 0, top: 0, width, height }} />
      {popOut ? <div style={layer}>{popOut}</div> : null}
    </div>
  );
}
