// R2's sunburst rays on the blue ground, centred at (cx, cy) in percent of the frame.
export function Sunburst({ cx = 50, cy = 42, color = "rgba(255, 255, 255, 0.08)" }: { cx?: number; cy?: number; color?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, background: `repeating-conic-gradient(from 0deg at ${cx}% ${cy}%, ${color} 0deg 11deg, rgba(255, 255, 255, 0) 11deg 30deg)` }}
    />
  );
}
