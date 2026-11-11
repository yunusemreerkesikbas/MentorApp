import { expect, it } from "vitest";
import { SOUND } from "../src/art";
import { PIECES } from "../src/pieces";
import { CUES, cueFrame, SFX } from "../src/t1/sfx";
import { EVENTS, sceneOf } from "../src/t1/timeline";

const FILM = PIECES.find((p) => p.id === "T1")!.video!.durationInFrames;

it("puts every effect on a named beat inside the film", () => {
  for (const c of CUES) {
    expect(EVENTS[c.scene][c.event], `${c.name}: ${c.scene}.${c.event}`).toBeTypeOf("number");
    // the file starts `hit` frames early so its loudest moment lands on the beat
    expect(cueFrame(c) - SFX[c.sound].hit, c.name).toBeGreaterThanOrEqual(0);
    expect(cueFrame(c)).toBeLessThan(FILM);
  }
});

it("mixes every effect at 0.5–0.8 of its levelled gain, under the music", () => {
  for (const c of CUES) {
    expect(c.mix, c.name).toBeGreaterThanOrEqual(0.5);
    expect(c.mix, c.name).toBeLessThanOrEqual(0.8);
  }
});

it("uses every downloaded effect and labels each cue once", () => {
  const files = Object.keys(SOUND).filter((k) => k.startsWith("t1Sfx"));
  expect(Object.keys(SFX).sort()).toEqual(files.sort());
  expect([...new Set(CUES.map((c) => c.sound))].sort()).toEqual(files.sort());
  expect(new Set(CUES.map((c) => c.name)).size).toBe(CUES.length);
});

it("lands the clip-borne hits on what the clips show", () => {
  // K4's two high-fives meet at scene 12 frame 90; the chest lid starts opening at clip 1.3 s = scene 14 frame 69.
  const local = (sound: string) => {
    const c = CUES.find((x) => x.sound === sound)!;
    return cueFrame(c) - sceneOf(c.scene).from;
  };
  expect([CUES.find((c) => c.sound === "t1SfxClap")!.scene, local("t1SfxClap")]).toEqual(["12", 90]);
  expect([CUES.find((c) => c.sound === "t1SfxLid")!.scene, local("t1SfxLid")]).toEqual(["14", 69]);
});
