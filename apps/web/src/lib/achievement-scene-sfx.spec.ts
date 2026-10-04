import { describe, expect, it } from "vitest";

import {
  GATHER_LENGTH,
  SCENE_MASTER_GAIN,
  SFX_VOICES,
  synthesizeRoom,
  synthesizeVoice,
  type StereoClip,
} from "./achievement-scene-sfx";

const RATE = 48_000;

function peak(clip: StereoClip): number {
  let max = 0;
  for (let i = 0; i < clip.left.length; i += 1) {
    max = Math.max(max, Math.abs(clip.left[i]!), Math.abs(clip.right[i]!));
  }
  return max;
}

function energy(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += samples[i]! ** 2;
  return sum;
}

describe("synthesizeVoice", () => {
  it("renders every voice audible, finite and below full scale", () => {
    for (const voice of SFX_VOICES) {
      const clip = synthesizeVoice(voice, RATE);
      expect(clip.left.length, voice).toBeGreaterThan(0);
      expect(clip.left.every(Number.isFinite), voice).toBe(true);
      expect(peak(clip), voice).toBeGreaterThan(0.03);
      expect(peak(clip), voice).toBeLessThan(0.75);
    }
  });

  it("sounds the same every time", () => {
    const a = synthesizeVoice("burst", RATE);
    const b = synthesizeVoice("burst", RATE);
    expect(Array.from(a.left.slice(0, 4_800))).toEqual(Array.from(b.left.slice(0, 4_800)));
  });

  it("swells the gather hum for exactly as long as the light can wait", () => {
    expect(synthesizeVoice("gather", RATE).left.length).toBe(Math.ceil(GATHER_LENGTH * RATE));
  });

  it("keeps the burst well under full scale and the chime at the app's chime level", () => {
    const loudest = Math.max(...SFX_VOICES.map((voice) => peak(synthesizeVoice(voice, RATE))));
    expect(loudest * SCENE_MASTER_GAIN).toBeLessThanOrEqual(0.5);
    const chime = peak(synthesizeVoice("chime", RATE)) * SCENE_MASTER_GAIN;
    expect(chime).toBeGreaterThanOrEqual(0.15);
    expect(chime).toBeLessThanOrEqual(0.35);
  });
});

describe("synthesizeRoom", () => {
  it("is a short, decaying stereo room", () => {
    const room = synthesizeRoom(RATE);
    const tenth = Math.floor(room.left.length / 10);
    const head = energy(room.left, 0, tenth * 2);
    const tail = energy(room.left, room.left.length - tenth, room.left.length);
    expect(head).toBeGreaterThan(0);
    expect(tail / head).toBeLessThan(0.01);
    expect(Array.from(room.left.slice(0, 2_000))).not.toEqual(Array.from(room.right.slice(0, 2_000)));
  });
});
