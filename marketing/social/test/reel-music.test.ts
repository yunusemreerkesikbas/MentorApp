import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { SOUND } from "../src/art";
import { PIECES } from "../src/pieces";
import { MUSIC_DROP_S, REEL_MUSIC_VOLUME, reelMusicVolume } from "../src/components/ReelMusic";

it("gives every reel except T1 a music bed: Igloo, Balkan for Premium", () => {
  const reels = PIECES.filter((p) => p.video && p.id !== "T1");
  expect(Object.fromEntries(reels.map((p) => [p.id, p.video!.music]))).toEqual({
    R1: "reelIgloo", R2: "reelIgloo", R3: "reelIgloo", IR1: "reelIgloo", WR1: "reelIgloo", PR1: "reelBalkan", PR2: "reelBalkan",
  });
  for (const t of ["reelIgloo", "reelBalkan"] as const) expect(existsSync(join("public", SOUND[t]))).toBe(true);
});

it("starts silent, plays at full bed level, ends silent", () => {
  expect(MUSIC_DROP_S).toBe(8);
  expect(reelMusicVolume("reelIgloo", 0, 30, 240)).toBe(0);
  expect(reelMusicVolume("reelIgloo", 120, 30, 240)).toBe(REEL_MUSIC_VOLUME.reelIgloo);
  expect(reelMusicVolume("reelBalkan", 120, 30, 240)).toBe(REEL_MUSIC_VOLUME.reelBalkan);
  expect(reelMusicVolume("reelBalkan", 239, 30, 240)).toBe(0);
});
