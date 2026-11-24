import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";
import { VISION_BOARD_CANVAS, type VisionBoardDoc, type VisionBoardTexture } from "@mentor/types";

const textures: Record<VisionBoardTexture, { color: string; tile: number; marks: React.ReactNode }> = {
  cork: {
    color: "#d8b083", tile: 40,
    marks: <>
      <Circle cx={3} cy={8} r={2.2} fill="#78522f" opacity={0.35} />
      <Circle cx={26} cy={18} r={2.6} fill="#a07446" opacity={0.3} />
      <Circle cx={15} cy={32} r={1.9} fill="#78522f" opacity={0.3} />
      <Circle cx={34} cy={36} r={1.4} fill="#fff" opacity={0.25} />
    </>,
  },
  paper: {
    color: "#faf7f2", tile: 16,
    marks: <Circle cx={4} cy={4} r={2} fill="#000" opacity={0.09} />,
  },
  grid: {
    color: "#fff", tile: 28,
    marks: <Path d="M0 0H28 M0 0V28" stroke="#111" strokeWidth={2} opacity={0.10} />,
  },
  linen: {
    color: "#f2efe9", tile: 16,
    marks: <Path d="M-4 4L4 -4 M0 16L16 0 M12 20L20 12 M-4 12L4 20 M0 0L16 16 M12 -4L20 4"
      stroke="#000" strokeWidth={3} opacity={0.07} />,
  },
  dots: {
    color: "#f5f6fb", tile: 24,
    marks: <Circle cx={5} cy={5} r={3} fill="#55acee" opacity={0.28} />,
  },
  stripes: {
    color: "#fdf6f0", tile: 23,
    marks: <Path d="M-5 5L5 -5 M0 23L23 0 M18 28L28 18" stroke="#f3705a" strokeWidth={6} opacity={0.14} />,
  },
};

export function BoardSurface({ background }: { background: VisionBoardDoc["background"] }) {
  const texture = background.kind === "texture" ? textures[background.value] : null;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none"
      viewBox={`0 0 ${VISION_BOARD_CANVAS.width} ${VISION_BOARD_CANVAS.height}`}>
      <Rect width="100%" height="100%" fill={texture?.color ?? background.value} />
      {texture && <>
        <Defs>
          <Pattern id="boardTexture" width={texture.tile} height={texture.tile} patternUnits="userSpaceOnUse">
            {texture.marks}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#boardTexture)" />
      </>}
    </Svg>
  );
}

// Match the web's proportions and wood gradient against the outer framed width.
export const boardFrames = {
  wood: { border: 0.022, mat: 0.026, radius: 0.005, rim: "#c99a5f", matColor: "#fbfaf8" },
  gallery: { border: 0.006, mat: 0.034, radius: 0.008, rim: "#e2e2e2", matColor: "#fff" },
  none: { border: 0, mat: 0, radius: 0, rim: "transparent", matColor: "transparent" },
} as const;

export function WoodMoulding({ radius }: { radius: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="woodMoulding" x1="0%" y1="0%" x2="100%" y2="20%">
          <Stop offset={0} stopColor="#c99a5f" />
          <Stop offset={0.18} stopColor="#e0b782" />
          <Stop offset={0.42} stopColor="#c08a4c" />
          <Stop offset={0.68} stopColor="#dcb17c" />
          <Stop offset={1} stopColor="#b8813f" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={radius} fill="url(#woodMoulding)" />
    </Svg>
  );
}
