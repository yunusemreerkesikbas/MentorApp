import type { CSSProperties, ReactNode } from "react";
import { nunito } from "../fonts";
import { SIZES, type Format } from "../pieces";
import { SafeZones } from "./SafeZones";

// One artboard: platform size, clipped, Nunito, optional safe-zone overlay on top.
export function Frame({
  format,
  background,
  color = "#FFFFFF",
  safe,
  style,
  children,
}: {
  format: Format;
  background: string;
  color?: string;
  safe: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { width, height } = SIZES[format];
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background, color, fontFamily: nunito, ...style }}>
      {children}
      <SafeZones format={format} show={safe} />
    </div>
  );
}
