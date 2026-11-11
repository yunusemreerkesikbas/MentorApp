import { useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../brand";
import { shake, slam } from "../../motion";

// Sticker type for words over a scene: white (second line yellow), thick navy outline, hard navy shadow.
// `color` overrides both lines. Each line slams in on its own beat (`at`, scene-local) with a short wobble. Centred in x 60–1020.
export function StickerWords({ lines, top, at, size = 104, color }: { lines: string[]; top: number; at: number[]; size?: number; color?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 60, width: 960, top, display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.08 }}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontSize: size,
            fontWeight: 1000,
            lineHeight: 1.05,
            textAlign: "center",
            color: color ?? (i === 1 ? C.yellow : "#FFFFFF"),
            WebkitTextStroke: `${size * 0.13}px ${C.t1Ink}`,
            paintOrder: "stroke fill",
            textShadow: `0 ${size * 0.09}px 0 ${C.t1Ink}`,
            scale: String(slam(frame, fps, at[i] ?? at[0]!)),
            rotate: `${shake(frame, at[i] ?? at[0]!)}deg`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
