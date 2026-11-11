import { expect, it } from "vitest";
import { CHEST_JUMP, CLIP_CUTS, CLIP_SCALE, EVENTS, KLING_MARK_TOP, rate, sceneOf, sourceFrames } from "../src/t1/timeline";

const clips = Object.entries(CLIP_CUTS);

it("fills each clip scene's window exactly, in order, without gaps", () => {
  for (const [clip, { scene, cuts }] of clips) {
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]!.at, clip).toBe(cuts[i - 1]!.at + cuts[i - 1]!.frames);
    const last = cuts.at(-1)!;
    expect(last.at + last.frames, clip).toBe(sceneOf(scene).durationInFrames);
  }
});

it("never reads past a clip's end and keeps the speed between 1x and 1.3x", () => {
  for (const [clip, { cuts }] of clips) {
    for (const c of cuts) {
      expect(c.clipStart, clip).toBeGreaterThanOrEqual(0);
      expect(c.clipEnd, clip).toBeGreaterThan(c.clipStart);
      expect(c.clipEnd, clip).toBeLessThanOrEqual(clip === "chest" ? 5.0 : 5.04);
      expect(rate(c), clip).toBeGreaterThanOrEqual(1);
      expect(rate(c), clip).toBeLessThanOrEqual(1.3);
    }
  }
});

it("pushes the KlingAI mark out of frame", () => {
  expect(KLING_MARK_TOP * 1920 * CLIP_SCALE).toBeGreaterThanOrEqual(1920);
});

it("never shows the chest clip's jump", () => {
  for (const c of CLIP_CUTS.chest.cuts) expect(c.clipEnd <= CHEST_JUMP[0] || c.clipStart >= CHEST_JUMP[1]).toBe(true);
});

// A sped-up <Video> counts durationInFrames in source frames (K1 stopped at 105 / 1.157 = 91 in a still check).
it("gives each sped-up cut enough source frames to fill its slot", () => {
  for (const [clip, { cuts }] of clips) {
    for (const c of cuts) {
      expect(sourceFrames(c) / rate(c), clip).toBeGreaterThanOrEqual(c.frames - 1e-6);
      expect(sourceFrames(c) / rate(c), clip).toBeLessThan(c.frames + 1);
    }
  }
});

it("hides the chest's second cut under the gold flash's peak", () => {
  const second = CLIP_CUTS.chest.cuts[1]!;
  expect(second.at).toBeGreaterThanOrEqual(EVENTS["14"].flash!);
  expect(second.at).toBeLessThanOrEqual(EVENTS["14"].flash! + 4);
});
