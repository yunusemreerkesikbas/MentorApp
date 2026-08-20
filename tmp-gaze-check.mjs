// Throwaway: confirms the gaze sprites moved only the pupils, and by how much.
import { readFileSync } from "node:fs";
import { decodeRgba } from "./apps/web/scripts/lib/png.mjs";

const dir = "apps/web/public/mascot/puhu/lamp/";
const load = (name) => decodeRgba(readFileSync(`${dir}puhu-lamp-${name}.png`));
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function pupils(img) {
  const { width: W, height: H, data } = img;
  const dark = (x, y) => {
    const o = (y * W + x) * 4;
    return data[o + 3] > 200 && lum(data[o], data[o + 1], data[o + 2]) < 70;
  };
  const seen = new Uint8Array(W * H);
  const blobs = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (seen[y * W + x] || !dark(x, y)) continue;
      const stack = [[x, y]];
      seen[y * W + x] = 1;
      let sx = 0, sy = 0, n = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        sx += cx; sy += cy; n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (seen[ny * W + nx] || !dark(nx, ny)) continue;
          seen[ny * W + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      blobs.push({ cx: sx / n, cy: sy / n, n });
    }
  }
  return blobs.sort((a, b) => b.n - a.n).slice(0, 2).sort((a, b) => a.cx - b.cx);
}

/** Fraction of pixels whose alpha differs by more than a hair — i.e. silhouette drift. */
function silhouetteDrift(a, b) {
  let differing = 0, opaque = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const aa = a.data[i + 3], ba = b.data[i + 3];
    if (aa > 128 || ba > 128) opaque++;
    if (Math.abs(aa - ba) > 64) differing++;
  }
  return { differing, opaque, pct: ((differing / opaque) * 100).toFixed(1) };
}

const rest = load("rest");
const scale = 60 / 265;

for (const name of ["rest", "gaze-left", "gaze-right"]) {
  const img = load(name);
  const [l, r] = pupils(img);
  console.log(
    `${name.padEnd(11)} pupil centres  left ${l.cx.toFixed(1)}  right ${r.cx.toFixed(1)}` +
      (name === "rest" ? "" : `  | drift vs rest ${silhouetteDrift(rest, img).pct}% of silhouette`),
  );
}

const [rl] = pupils(rest);
for (const name of ["gaze-left", "gaze-right"]) {
  const [l] = pupils(load(name));
  const shift = l.cx - rl.cx;
  console.log(`${name}: pupil moves ${shift.toFixed(1)}px in source = ${(shift * scale).toFixed(2)}px on screen`);
}
