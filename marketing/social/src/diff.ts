// Share of RGBA pixels whose largest channel difference exceeds delta.
export function diffRatio(a: Uint8Array, b: Uint8Array, delta: number): number {
  if (a.length !== b.length) throw new Error(`size mismatch: ${a.length} vs ${b.length} bytes`);
  let off = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
      Math.abs(a[i + 3] - b[i + 3]),
    );
    if (d > delta) off++;
  }
  return off / (a.length / 4);
}
