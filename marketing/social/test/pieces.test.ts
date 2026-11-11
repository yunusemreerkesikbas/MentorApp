import { expect, it } from "vitest";
import { FONT_SUBSETS } from "../src/brand";
import { BEAT, compositionIds, EXPORT_PROPS, guideVisible, PIECES, SIZES, STUDIO_PROPS, type PieceId } from "../src/pieces";

const byId = (id: PieceId) => PIECES.find((p) => p.id === id)!;

it("lists the 15 launch pieces in posting-plan order, then the 6 Premium pieces, T1, then the feature ads", () => {
  expect(PIECES.map((p) => p.id)).toEqual([
    "F1", "F2", "F3", "F4", "F5", "F6", "S1", "S2", "S3", "S4", "R1", "R2", "R3", "X1", "L1",
    "PF1", "PF2", "PS1", "PS2", "PR1", "PR2", "T1",
    "IF1", "IF2", "IF3", "IF4", "IF5", "IF6", "IS1", "IS2", "IS3", "IS4", "IS5", "IS6", "IR1",
  ]);
});

it("pins the feature reel at 8 s = 16 beats", () => {
  expect(byId("IR1").video).toEqual({ fps: 30, durationInFrames: 240, endCardFrom: 180, coverFrame: 150 });
});

it("pins the promo film's timing", () => {
  expect(byId("T1").video).toEqual({ fps: 30, durationInFrames: 1860, endCardFrom: 1800, coverFrame: 475 });
});

it("uses the platform sizes", () => {
  expect(SIZES).toEqual({
    feed: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 },
    reel: { width: 1080, height: 1920 },
    landscape: { width: 1200, height: 675 },
  });
});

it("splits the carousel into one composition per card", () => {
  expect(compositionIds(byId("F4"))).toEqual(["F4-1", "F4-2", "F4-3", "F4-4", "F4-5"]);
  expect(compositionIds(byId("F1"))).toEqual(["F1"]);
});

it("pins the reel timings", () => {
  expect(byId("R1").video).toEqual({ fps: 30, durationInFrames: 300, endCardFrom: 180, coverFrame: 120 });
  expect(byId("R2").video).toEqual({ fps: 30, durationInFrames: 360, endCardFrom: 270, coverFrame: 210 });
  expect(byId("R3").video).toEqual({ fps: 30, durationInFrames: 270, endCardFrom: 195, coverFrame: 120 });
});

it("holds every end card for 2 s on the beat grid, with the cover inside the video", () => {
  for (const p of PIECES.filter((x) => x.video)) {
    const v = p.video!;
    expect(v.durationInFrames - v.endCardFrom, p.id).toBeGreaterThanOrEqual(60);
    expect(v.endCardFrom % BEAT, p.id).toBe(0);
    expect(v.coverFrame, p.id).toBeGreaterThanOrEqual(0);
    expect(v.coverFrame, p.id).toBeLessThan(v.durationInFrames);
  }
});

it("exports without guides or safe-zone overlays", () => {
  expect(EXPORT_PROPS).toEqual({ guides: false, safe: false });
  expect(STUDIO_PROPS).toEqual({ guides: true, safe: false });
});

it("loads the latin-ext subset for Turkish letters", () => {
  expect(FONT_SUBSETS).toContain("latin-ext");
});

it("shows sticker guides in Studio only, never in a render", () => {
  expect(guideVisible(true, false)).toBe(true);
  expect(guideVisible(true, true)).toBe(false);
  expect(guideVisible(false, false)).toBe(false);
});
