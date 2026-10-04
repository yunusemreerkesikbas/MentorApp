// Builds the Defterlerim desk Puhu (the reading set) from the generator's magenta frames.
//
//   node apps/web/scripts/desk-puhu-sprites.mjs <raw-dir> [out-dir] [--max=480]
//
// <raw-dir> holds six edits of one render, same canvas and pose, on a flat magenta background:
// read-left.png (the base), read-right.png, blink.png, peek-left.png, peek-right.png and wave.png.
// out-dir defaults to public/mascot/puhu/desk.
//
// The generator repaints the whole picture on every edit, so two frames that only "move the
// pupils" still differ all over the fluff. Cutting between them would make the body shimmer. So
// every eye frame is the base with only what actually changed around the glasses pasted in, and
// the feet are cut out into their own layers (the body gets belly painted in where they were) so
// the component can swing them. wave.png changes the whole pose and is taken as it is, minus feet.
//
// All outputs share one canvas: the union of every frame's content plus a margin, cropped the same
// way for all, then keyed and scaled by key-alpha.mjs. The script prints the canvas and the feet's
// pivots for DESK_PUHU_ART in desk-puhu.tsx.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { alphaBounds, decodeRgba, encodeRgba } from "./lib/png.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const KEY = [255, 0, 255];
/** Further than this from magenta is the subject; the keyer does the soft edge later. */
const SUBJECT_DISTANCE = 120;
/** The band the glasses sit in, as fractions of the canvas. Eye changes are only looked for here. */
const EYE_BAND = { left: 0.2, right: 0.79, top: 0.29, bottom: 0.585 };
/** How far a pixel must move between frames to count as a change, not repainted fluff. */
const EYE_CHANGE = 44;
const FRAMES = ["read-left", "read-right", "blink", "peek-left", "peek-right", "wave"];
const EYE_FRAMES = ["read-right", "blink", "peek-left", "peek-right"];

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

function distanceToKey(data, at) {
  const dr = data[at] - KEY[0];
  const dg = data[at + 1] - KEY[1];
  const db = data[at + 2] - KEY[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isSubject(image, x, y) {
  return distanceToKey(image.data, (y * image.width + x) * 4) > SUBJECT_DISTANCE;
}

/** Square dilation by `radius`, done as two running-window passes. */
function dilate(mask, width, height, radius) {
  const across = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = -radius; x < width; x++) {
      const enter = x + radius;
      if (enter < width && mask[y * width + enter]) count++;
      const leave = x - radius - 1;
      if (leave >= 0 && mask[y * width + leave]) count--;
      if (x >= 0) across[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = -radius; y < height; y++) {
      const enter = y + radius;
      if (enter < height && across[enter * width + x]) count++;
      const leave = y - radius - 1;
      if (leave >= 0 && across[leave * width + x]) count--;
      if (y >= 0) out[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

/** Box blur of a 0..1 field, run twice so the edge falls off softly instead of linearly. */
function soften(field, width, height, radius) {
  let current = Float32Array.from(field);
  for (let pass = 0; pass < 2; pass++) {
    const across = new Float32Array(current.length);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = -radius; x < width; x++) {
        const enter = x + radius;
        if (enter < width) sum += current[y * width + enter];
        const leave = x - radius - 1;
        if (leave >= 0) sum -= current[y * width + leave];
        if (x >= 0) across[y * width + x] = sum / (radius * 2 + 1);
      }
    }
    const down = new Float32Array(current.length);
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y < height; y++) {
        const enter = y + radius;
        if (enter < height) sum += across[enter * width + x];
        const leave = y - radius - 1;
        if (leave >= 0) sum -= across[leave * width + x];
        if (y >= 0) down[y * width + x] = sum / (radius * 2 + 1);
      }
    }
    current = down;
  }
  return current;
}

/** Connected regions of a mask (4-neighbour), largest first. */
function regions(mask, width, height) {
  const label = new Int32Array(mask.length);
  const found = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]) continue;
    const id = found.length + 1;
    const stack = [start];
    label[start] = id;
    const region = { id, size: 0, left: width, right: 0, top: height, bottom: 0, pixels: [] };
    while (stack.length) {
      const at = stack.pop();
      const x = at % width;
      const y = (at - x) / width;
      region.size++;
      region.pixels.push(at);
      region.left = Math.min(region.left, x);
      region.right = Math.max(region.right, x);
      region.top = Math.min(region.top, y);
      region.bottom = Math.max(region.bottom, y);
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (next < 0 || next >= mask.length || label[next] || !mask[next]) continue;
        if ((next === at - 1 || next === at + 1) && Math.floor(next / width) !== y) continue;
        label[next] = id;
        stack.push(next);
      }
    }
    found.push(region);
  }
  return found.sort((a, b) => b.size - a.size);
}

const isFootColour = (r, g, b) => r > 170 && b < 130 && r - b > 110 && g > 60 && g < r - 15;

/** The two feet of a frame, left then right, as pixel lists. */
function findFeet(image) {
  const { width, height, data } = image;
  const mask = new Uint8Array(width * height);
  for (let y = Math.floor(height * 0.7); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (isFootColour(data[at], data[at + 1], data[at + 2])) mask[y * width + x] = 1;
    }
  }
  const feet = regions(mask, width, height).slice(0, 2);
  if (feet.length < 2 || feet[1].size < width * height * 0.004) {
    throw new Error("could not find two feet below the body; are they hanging free of it?");
  }
  return feet.sort((a, b) => a.left - b.left);
}

function maskOf(pixels, length) {
  const mask = new Uint8Array(length);
  for (const at of pixels) mask[at] = 1;
  return mask;
}

/** Last subject row of a column at or below `fromY`: where the belly ends beside a foot. */
function bellyBottom(image, x, fromY) {
  let y = fromY;
  while (y < image.height - 1 && isSubject(image, x, y + 1)) y++;
  return y;
}

/**
 * Takes the feet off a frame. Below the belly line the pixels become background; above it (where a
 * foot overlapped the belly) belly is painted in by relaxing the surrounding fluff into the gap,
 * which is all a swinging foot ever uncovers.
 */
function removeFeet(image, feet) {
  const { width, height, data } = image;
  const out = { width, height, data: Uint8Array.from(data) };
  for (const foot of feet) {
    const erase = dilate(maskOf(foot.pixels, width * height), width, height, 6);
    let left = width;
    let right = 0;
    let top = height;
    for (let at = 0; at < erase.length; at++) {
      if (!erase[at]) continue;
      const x = at % width;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, (at - x) / width);
    }
    const leftEdge = bellyBottom(image, left - 2, top);
    const rightEdge = bellyBottom(image, right + 2, top);
    const line = (x) => leftEdge + ((rightEdge - leftEdge) * (x - left)) / Math.max(1, right - left);

    const gap = [];
    for (let at = 0; at < erase.length; at++) {
      if (!erase[at]) continue;
      const x = at % width;
      const y = (at - x) / width;
      if (y <= line(x)) gap.push(at);
      else out.data.set(KEY, at * 4);
    }

    const inGap = new Uint8Array(width * height);
    for (const at of gap) inGap[at] = 1;
    const usable = (at) => inGap[at] || (!erase[at] && distanceToKey(out.data, at * 4) > SUBJECT_DISTANCE);
    // Start from the average of the fluff around the gap, then relax.
    let seed = [0, 0, 0];
    let seeds = 0;
    for (const at of gap) {
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (inGap[next] || !usable(next)) continue;
        for (let c = 0; c < 3; c++) seed[c] += out.data[next * 4 + c];
        seeds++;
      }
    }
    seed = seed.map((value) => value / Math.max(1, seeds));
    const colour = new Float32Array(gap.length * 3);
    gap.forEach((_, i) => colour.set(seed, i * 3));
    const index = new Int32Array(width * height).fill(-1);
    gap.forEach((at, i) => (index[at] = i));
    for (let round = 0; round < 600; round++) {
      for (let i = 0; i < gap.length; i++) {
        const at = gap[i];
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (const next of [at - 1, at + 1, at - width, at + width]) {
          if (next < 0 || next >= width * height || !usable(next)) continue;
          const j = index[next];
          if (j >= 0) {
            r += colour[j * 3];
            g += colour[j * 3 + 1];
            b += colour[j * 3 + 2];
          } else {
            r += out.data[next * 4];
            g += out.data[next * 4 + 1];
            b += out.data[next * 4 + 2];
          }
          n++;
        }
        if (n) colour.set([r / n, g / n, b / n], i * 3);
      }
    }
    gap.forEach((at, i) => {
      for (let c = 0; c < 3; c++) out.data[at * 4 + c] = Math.round(colour[i * 3 + c]);
    });
  }
  return out;
}

/** One foot on an otherwise empty canvas, with a few pixels of its edge for the keyer to soften. */
function footLayer(image, foot) {
  const { width, height, data } = image;
  const keep = dilate(maskOf(foot.pixels, width * height), width, height, 3);
  const out = { width, height, data: new Uint8Array(data.length) };
  for (let at = 0; at < keep.length; at++) {
    if (keep[at]) out.data.set(data.subarray(at * 4, at * 4 + 4), at * 4);
    else out.data.set([...KEY, 255], at * 4);
  }
  return out;
}

/** The base with only what changed around the glasses taken from `frame`, feathered in. */
function eyesOnto(base, frame) {
  const { width, height } = base;
  const changed = new Uint8Array(width * height);
  const x0 = Math.round(width * EYE_BAND.left);
  const x1 = Math.round(width * EYE_BAND.right);
  const y0 = Math.round(height * EYE_BAND.top);
  const y1 = Math.round(height * EYE_BAND.bottom);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = (y * width + x) * 4;
      const moved = Math.max(
        Math.abs(base.data[at] - frame.data[at]),
        Math.abs(base.data[at + 1] - frame.data[at + 1]),
        Math.abs(base.data[at + 2] - frame.data[at + 2]),
      );
      if (moved > EYE_CHANGE) changed[y * width + x] = 1;
    }
  }
  // Specks of repainted fluff are dropped; the eyes are a few large patches.
  const patches = regions(dilate(changed, width, height, 4), width, height).filter(
    (region) => region.size > width * height * 0.0015,
  );
  const kept = new Uint8Array(width * height);
  for (const patch of patches) for (const at of patch.pixels) kept[at] = 1;
  const weight = soften(dilate(kept, width, height, 8), width, height, 6);

  const out = { width, height, data: Uint8Array.from(base.data) };
  for (let i = 0; i < weight.length; i++) {
    const w = weight[i];
    if (w <= 0.001) continue;
    for (let c = 0; c < 3; c++) {
      out.data[i * 4 + c] = Math.round(base.data[i * 4 + c] * (1 - w) + frame.data[i * 4 + c] * w);
    }
  }
  return { image: out, patches: patches.length };
}

function subjectBounds(image) {
  let left = image.width;
  let right = 0;
  let top = image.height;
  let bottom = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!isSubject(image, x, y)) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, right, top, bottom };
}

function crop(image, box) {
  const width = box.right - box.left + 1;
  const height = box.bottom - box.top + 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x + box.left;
      const sy = y + box.top;
      const to = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) {
        data.set([...KEY, 255], to);
      } else {
        data.set(image.data.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4), to);
      }
    }
  }
  return { width, height, data };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [rawDir, outArg] = positional;
if (!rawDir) {
  console.error("usage: desk-puhu-sprites.mjs <raw-dir> [out-dir] [--max=480]");
  process.exit(1);
}
const outDir = resolve(outArg ?? join(here, "../public/mascot/puhu/desk"));
const max = Number(flags.max ?? 480);

const raw = Object.fromEntries(
  FRAMES.map((name) => [name, decodeRgba(readFileSync(join(rawDir, `${name}.png`)))]),
);
const base = raw["read-left"];
for (const name of FRAMES) {
  if (raw[name].width !== base.width || raw[name].height !== base.height) {
    throw new Error(`${name}.png is ${raw[name].width}x${raw[name].height}; every frame must share read-left's canvas`);
  }
}

const feet = findFeet(base);
const body = removeFeet(base, feet);
const sprites = {
  "read-left": body,
  "foot-left": footLayer(base, feet[0]),
  "foot-right": footLayer(base, feet[1]),
  wave: removeFeet(raw.wave, findFeet(raw.wave)),
};
for (const name of EYE_FRAMES) {
  const { image, patches } = eyesOnto(body, raw[name]);
  sprites[name] = image;
  console.log(`${name}: ${patches} eye patch(es) taken over the base`);
}

// One crop for all, so the sprites stay aligned once they are trimmed.
const bounds = Object.values(sprites).map(subjectBounds);
const margin = Math.round(base.width * 0.008);
const box = {
  left: Math.max(0, Math.min(...bounds.map((b) => b.left)) - margin),
  right: Math.min(base.width - 1, Math.max(...bounds.map((b) => b.right)) + margin),
  top: Math.max(0, Math.min(...bounds.map((b) => b.top)) - margin),
  bottom: Math.min(base.height - 1, Math.max(...bounds.map((b) => b.bottom)) + margin),
};
const canvas = { width: box.right - box.left + 1, height: box.bottom - box.top + 1 };

const work = mkdtempSync(join(tmpdir(), "desk-puhu-"));
try {
  for (const [name, image] of Object.entries(sprites)) {
    const staged = join(work, `${name}.png`);
    writeFileSync(staged, encodeRgba(crop(image, box)));
    execFileSync(
      process.execPath,
      [
        join(here, "key-alpha.mjs"),
        staged,
        join(outDir, `${name}.png`),
        "--key=ff00ff",
        "--hard=70",
        "--soft=150",
        `--max=${max}`,
      ],
      { stdio: "inherit" },
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

// Where each foot hangs from: the middle of its top edge, a little inside it.
for (const [side, foot] of [
  ["left", feet[0]],
  ["right", feet[1]],
]) {
  const topRows = foot.pixels.filter((at) => Math.floor(at / base.width) <= foot.top + 24);
  const x = topRows.reduce((sum, at) => sum + (at % base.width), 0) / topRows.length;
  const y = foot.top + 14;
  console.log(
    `pivot ${side}: ${(((x - box.left) / canvas.width) * 100).toFixed(1)}% ` +
      `${(((y - box.top) / canvas.height) * 100).toFixed(1)}%`,
  );
}
const final = decodeRgba(readFileSync(join(outDir, "read-left.png")));
const finalBounds = alphaBounds(final);
// Where he sits: the bottom of the belly between the feet, which goes on the top book.
const middle = Math.round(final.width / 2);
let seat = final.height - 1;
while (seat > 0 && final.data[(seat * final.width + middle) * 4 + 3] < 128) seat--;
console.log(
  `canvas ${final.width}x${final.height} ` +
    `(content ${finalBounds.width}x${finalBounds.height} at ${finalBounds.left},${finalBounds.top}) | ` +
    `seat ${((seat / final.height) * 100).toFixed(1)}%`,
);
