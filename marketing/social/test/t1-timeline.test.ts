import { expect, it } from "vitest";
import { BEAT, PIECES } from "../src/pieces";
import { cardAt } from "../src/t1/scenes/S15";
import { EVENTS, SCENES, sceneOf } from "../src/t1/timeline";

const VIDEO = PIECES.find((p) => p.id === "T1")!.video!;
const inside = (id: Parameters<typeof sceneOf>[0], f: number) => f >= sceneOf(id).from && f < sceneOf(id).from + sceneOf(id).durationInFrames;

it("lays the 17 scenes end to end from frame 0 to 1860, each starting on the beat", () => {
  expect(SCENES.map((s) => s.id)).toEqual(Array.from({ length: 17 }, (_, i) => String(i + 1).padStart(2, "0")));
  let at = 0;
  for (const s of SCENES) {
    expect(s.from, s.id).toBe(at);
    expect(s.from % BEAT, s.id).toBe(0);
    at += s.durationInFrames;
  }
  expect(at).toBe(VIDEO.durationInFrames);
});

it("puts the drop on scene 05, the cover inside scene 06 and the end card inside scene 17", () => {
  expect(sceneOf("05").from).toBe(240);
  expect(inside("06", VIDEO.coverFrame)).toBe(true);
  expect(inside("17", VIDEO.endCardFrom)).toBe(true);
  expect(VIDEO.durationInFrames - VIDEO.endCardFrom).toBeGreaterThanOrEqual(60);
});

it("keeps every beat event inside its scene and on the beat grid", () => {
  for (const s of SCENES) {
    for (const [name, v] of Object.entries(EVENTS[s.id])) {
      expect(v, `${s.id}.${name}`).toBeGreaterThanOrEqual(0);
      expect(v, `${s.id}.${name}`).toBeLessThan(s.durationInFrames);
      expect(v % BEAT, `${s.id}.${name}`).toBe(0);
    }
  }
});

it("gives scene 15 six seconds and scene 16 four and a half (owner, 2026-11-10: too fast)", () => {
  expect(sceneOf("15").durationInFrames).toBe(180);
  expect(sceneOf("16").durationInFrames).toBe(135);
  expect(sceneOf("17").from).toBe(1755);
});

it("15: holds each nickname front-on for at least 25 frames, in order", () => {
  const front = new Map<string, number>();
  for (let f = 0; f < sceneOf("15").durationInFrames; f++) {
    const { face, angle } = cardAt(f);
    const a = ((angle % 360) + 360) % 360;
    if (a < 15 || a > 345) front.set(face, (front.get(face) ?? 0) + 1);
  }
  expect([...front.keys()]).toEqual(["t1CharStreak", "t1CharBrave", "t1CharFocus"]);
  for (const [face, n] of front) expect(n, face).toBeGreaterThanOrEqual(25);
});

it("16: the light flies for a second, the window glows, then the camera dives in", () => {
  const E = EVENTS["16"];
  expect(E.light).toBeGreaterThanOrEqual(15); // the facade shows first
  expect(E.lit! - E.light!).toBeGreaterThanOrEqual(30);
  expect(E.dive! - E.lit!).toBeGreaterThanOrEqual(15);
  expect(E.clip! - E.dive!).toBeGreaterThanOrEqual(15);
});
