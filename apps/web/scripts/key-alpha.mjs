// Turns a flat-background render into a transparent PNG: keys out one colour, feathers the edge,
// and removes the background's spill from semi-transparent pixels.
//
//   node apps/web/scripts/key-alpha.mjs in.png out.png --key=ff00ff [--soft=90] [--hard=30]
//                                       [--trim] [--despill=0] [--max=320]
//
// `hard` is the distance under which a pixel is pure background, `soft` the distance over which it
// is pure subject; between them the pixel is blended and gets fractional alpha.
import { readFileSync, writeFileSync } from "node:fs";

import { alphaBounds, decodeRgba, encodeRgba, resize } from "./lib/png.mjs";

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [name, value] = arg.slice(2).split("=");
      flags[name] = value ?? true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function parseHex(value) {
  const clean = String(value).replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}

function crop(image, box) {
  const data = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const from = ((y + box.top) * image.width + box.left) * 4;
    data.set(image.data.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [input, output] = positional;
if (!input || !output) {
  console.error("usage: key-alpha.mjs <in.png> <out.png> --key=RRGGBB [--soft=90] [--hard=30] [--trim]");
  process.exit(1);
}

const key = parseHex(flags.key ?? "ff00ff");
const hard = Number(flags.hard ?? 30);
const soft = Number(flags.soft ?? 90);
const despill = flags.despill !== "0";

// Channels the key is made of, and the one it lacks. A pixel is only tinted by the background if
// *every* key channel sits above the missing one, which no colour in the mascot palette does.
const minorChannel = key.indexOf(Math.min(...key));
const majorChannels = [0, 1, 2].filter((c) => c !== minorChannel && key[c] > key[minorChannel]);

const image = decodeRgba(readFileSync(input));
const { width, height, data } = image;

for (let i = 0; i < width * height; i++) {
  const at = i * 4;
  const dr = data[at] - key[0];
  const dg = data[at + 1] - key[1];
  const db = data[at + 2] - key[2];
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);

  if (distance <= hard) {
    data[at + 3] = 0;
    continue;
  }

  if (distance < soft) {
    // Partially blended edge: recover the subject's own colour by undoing the background mix.
    const alpha = (distance - hard) / (soft - hard);
    data[at + 3] = Math.round(alpha * 255);
    for (let c = 0; c < 3; c++) {
      data[at + c] = Math.max(
        0,
        Math.min(255, Math.round((data[at + c] - (1 - alpha) * key[c]) / alpha)),
      );
    }
  }

  if (despill && majorChannels.every((c) => data[at + c] > data[at + minorChannel])) {
    const ceiling = data[at + minorChannel];
    for (const c of majorChannels) data[at + c] = ceiling;
  }
}

const bounds = alphaBounds(image);
if (!bounds) {
  console.error(`${input}: everything was keyed away — is --key right?`);
  process.exit(1);
}

let result = flags.trim ? crop(image, bounds) : image;

// Downscaling last keeps the key and despill working on the crisp original, and — because the
// factor is driven by the canvas, not the content — sprites sharing a canvas stay aligned.
if (flags.max) {
  const max = Number(flags.max);
  const factor = max / Math.max(result.width, result.height);
  if (factor < 1) {
    result = resize(
      result,
      Math.round(result.width * factor),
      Math.round(result.height * factor),
    );
  }
}

writeFileSync(output, encodeRgba(result));

const finalBounds = alphaBounds(result) ?? bounds;
console.log(
  `${output}: canvas ${result.width}x${result.height} | content ${finalBounds.width}x${finalBounds.height} ` +
    `at (${finalBounds.left},${finalBounds.top}) | coverage ${(finalBounds.coverage * 100).toFixed(1)}%`,
);
