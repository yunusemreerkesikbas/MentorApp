// Reports canvas size, transparency and the content bounding box of PNGs, so mascot sprites can be
// checked for real alpha and consistent framing before they are wired into a component.
//
//   node apps/web/scripts/inspect-png.mjs rest=a.png reach=b.png
import { readFileSync } from "node:fs";

import { alphaBounds, decodeRgba } from "./lib/png.mjs";

const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

function report(label, file) {
  let image;
  try {
    image = decodeRgba(readFileSync(file));
  } catch (error) {
    console.log(`${label}: cannot decode — ${error.message}`);
    return;
  }

  const { width, height, data } = image;
  const bounds = alphaBounds(image);

  if (!bounds || bounds.coverage > 0.999) {
    const corners = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
    ].map(([x, y]) => {
      const at = (y * width + x) * 4;
      return hex(data[at], data[at + 1], data[at + 2]);
    });
    console.log(
      `${label}: ${width}x${height} -> NO TRANSPARENCY, background is painted in. ` +
        `Corners: ${corners.join(" ")}`,
    );
    return;
  }

  console.log(
    `${label}: canvas ${width}x${height} | content ${bounds.width}x${bounds.height} at ` +
      `(${bounds.left},${bounds.top}) | centre ` +
      `(${Math.round(bounds.left + bounds.width / 2)},${Math.round(bounds.top + bounds.height / 2)}) ` +
      `| coverage ${(bounds.coverage * 100).toFixed(1)}%`,
  );
}

for (const arg of process.argv.slice(2)) {
  const index = arg.indexOf("=");
  if (index < 0) report(arg, arg);
  else report(arg.slice(0, index), arg.slice(index + 1));
}
