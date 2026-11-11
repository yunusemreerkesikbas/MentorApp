import { existsSync, readdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ART, CLIPS, END_CARD_PUHU, END_CARD_SHIFT, SOUND, type ArtKey } from "../src/art";

it("finds every art file, clip and sound under public/", () => {
  const missing = [...Object.values(ART), ...Object.values(CLIPS), ...Object.values(SOUND)].filter((p) => !existsSync(join("public", p)));
  expect(missing).toEqual([]);
});

const alphaOf = async (key: ArtKey) => {
  const { data, info } = await sharp(join("public", ART[key])).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, a: (x: number, y: number) => data[(y * info.width + x) * 4 + 3] };
};

it("gives end cards only free-standing Puhus (no hard crop on any edge)", async () => {
  for (const key of END_CARD_PUHU) {
    const { w, h, a } = await alphaOf(key);
    // Trimmed art touches its edges at a few pixels; a cropped peek has a long opaque run (p2: 57–67 %).
    const share = (n: number, at: (i: number) => [number, number]) => Array.from({ length: n }, (_, i) => a(...at(i))).filter((v) => v > 128).length / n;
    const worst = Math.max(share(w, (x) => [x, 0]), share(w, (x) => [x, h - 1]), share(h, (y) => [0, y]), share(h, (y) => [w - 1, y]));
    expect(worst, key).toBeLessThanOrEqual(0.05);
  }
});

// ponytail: readPuhu stays in S3 until the owner's P5 art replaces it. T1 shows the app's own small art at
// its size: career Puhus (320 px, the white ground is the sticker card), desk Puhu (360 px), open chest (384 px).
const SMALL_OK = new Set<ArtKey>([
  "readPuhu",
  "t1CareerSaglik", "t1CareerMuhendislik", "t1CareerHukuk", "t1CareerYazilim", "t1CareerEgitim",
  "t1CareerIsletme", "t1CareerSosyal", "t1CareerSanat", "t1CareerFen", "t1CareerMimarlik",
  "t1DeskPuhuLeft", "t1DeskPuhuRight", "t1DeskPuhuBlink", "t1DeskPuhuPeek",
  "t1ChestOpen",
]);

const sources = (d: string): string[] =>
  readdirSync(d, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => readFileSync(join(e.parentPath, e.name), "utf8"));

it("keeps small (< 600 px) mascot art out of every piece", async () => {
  const src = ["src/pieces", "src/components", "src/t1"].flatMap(sources).join("\n");
  const used: string[] = [];
  for (const key of Object.keys(ART) as ArtKey[]) {
    if (SMALL_OK.has(key)) continue;
    const { width } = await sharp(join("public", ART[key])).metadata();
    if (width! < 600 && new RegExp(`ART[.]${key}(?![A-Za-z0-9_])|["']${key}["']`).test(src)) used.push(key);
  }
  expect(used).toEqual([]);
});

// The end card draws Puhu in a 660 px box under the centred logo. His body axis (midway between the head
// and the feet) must land on the frame's centre, whatever empty space or cape the PNG carries.
it("puts each end-card Puhu's body on the logo's axis", async () => {
  for (const key of END_CARD_PUHU) {
    const { w, h, a } = await alphaOf(key);
    let top = h, bottom = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 4) if (a(x, y) > 40) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const mid = (f0: number, f1: number) => {
      let lo = w, hi = 0;
      for (let y = Math.round(top + (bottom - top) * f0); y < top + (bottom - top) * f1; y++)
        for (let x = 0; x < w; x++) if (a(x, y) > 40) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
      return (lo + hi) / 2 / w;
    };
    const axis = (mid(0.15, 0.35) + mid(0.92, 1)) / 2;
    const shown = 660 * Math.min(1, w / h); // objectFit contain in a 660 x 660 box
    expect(Math.abs((axis - 0.5) * shown + (END_CARD_SHIFT[key] ?? 0)), key).toBeLessThanOrEqual(12);
  }
});
