import { expect, it } from "vitest";
import { DR_CUES, DR_MUSIC } from "../src/dr-sfx";
import { PIECES } from "../src/pieces";
import { SFX } from "../src/t1/sfx";

it("lands every wave 2 reel effect inside its reel, at 0.5–0.8 of the levelled gain", () => {
  for (const [id, cues] of Object.entries(DR_CUES)) {
    const v = PIECES.find((p) => p.id === id)!.video!;
    expect(cues.length, id).toBeGreaterThan(3);
    for (const c of cues) {
      expect(c.at - SFX[c.sound].hit, `${id} ${c.sound}@${c.at}`).toBeGreaterThanOrEqual(0);
      expect(c.at, `${id} ${c.sound}@${c.at}`).toBeLessThan(v.durationInFrames);
      expect(c.mix).toBeGreaterThanOrEqual(0.5);
      expect(c.mix).toBeLessThanOrEqual(0.8);
    }
  }
});

it("gives each music twin its own track, on a bar of T1 for DRP", () => {
  expect(new Set(Object.values(DR_MUSIC).map((m) => m.sound)).size).toBe(4);
  const film = PIECES.find((p) => p.id === "T1")!.video!.durationInFrames;
  expect(DR_MUSIC.DRP.from % 60).toBe(0);
  expect(DR_MUSIC.DRP.from + 240).toBeLessThanOrEqual(film);
});
