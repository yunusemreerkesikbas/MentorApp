import { existsSync, readdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ART, END_CARD_PUHU, type ArtKey } from "../src/art";

it("finds every art file under public/", () => {
  const missing = Object.values(ART).filter((p) => !existsSync(join("public", p)));
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

// ponytail: readPuhu stays in S3 until the owner's P5 art replaces it.
const SMALL_OK = new Set<ArtKey>(["readPuhu"]);

it("keeps small (< 600 px) mascot art out of every piece", async () => {
  const src = ["src/pieces", "src/components"].flatMap((d) => readdirSync(d).map((f) => readFileSync(join(d, f), "utf8"))).join("\n");
  const used: string[] = [];
  for (const key of Object.keys(ART) as ArtKey[]) {
    if (SMALL_OK.has(key)) continue;
    const { width } = await sharp(join("public", ART[key])).metadata();
    if (width! < 600 && new RegExp(`ART[.]${key}(?![A-Za-z0-9_])|["']${key}["']`).test(src)) used.push(key);
  }
  expect(used).toEqual([]);
});
