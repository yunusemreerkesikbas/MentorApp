import { describe, expect, it } from "vitest";

import { CHOREO, deckLayout, exitDuration, resolveBeats } from "./scene-choreography";
import {
  copyPose,
  curtainPose,
  deckBadgePose,
  exitBadgePose,
  flashOpacity,
  hintPose,
  orbPose,
  singleBadgePose,
  type StageGeometry,
} from "./scene-poses";

const geo: StageGeometry = { center: { x: 195, y: 318 }, size: 236, viewport: { width: 390, height: 844 } };
const lit = resolveBeats({ ignitedAt: 1.95, exitAt: null, count: 1 });
const flightScale = { size: geo.size, edge: geo.size };

describe("curtainPose", () => {
  it("falls over the dusk and lifts on the exit", () => {
    const beats = resolveBeats({ ignitedAt: 1.95, exitAt: 6, count: 1 });
    expect(curtainPose(0, beats).night).toBe(0);
    expect(curtainPose(CHOREO.dusk, beats).night).toBe(1);
    expect(curtainPose(5, beats).shift).toBeCloseTo(0);
    expect(curtainPose(6 + exitDuration(1), beats).night).toBe(0);
  });
});

describe("the light before the badge", () => {
  it("has no orb before the spark lands or after the burst", () => {
    expect(orbPose(0.5, lit)).toBeNull();
    expect(orbPose(1.2, lit)).not.toBeNull();
    expect(orbPose(lit.burst! + 0.1, lit)).toBeNull();
  });

  it("squashes the orb for the windup", () => {
    const windup = orbPose(lit.ignite! + CHOREO.windup * 0.9, lit)!;
    expect(windup.sx).toBeGreaterThan(windup.sy);
  });

  it("shows the hint only while the light waits", () => {
    expect(hintPose(0.8, lit).opacity).toBe(0);
    expect(hintPose(1.5, lit).opacity).toBeGreaterThan(0.9);
    expect(hintPose(lit.ignite! + 0.2, lit).opacity).toBe(0);
  });

  it("flashes on the burst and lets it go", () => {
    expect(flashOpacity(lit.burst! - 0.01, lit)).toBe(0);
    expect(flashOpacity(lit.burst! + 0.05, lit)).toBeGreaterThan(0.9);
    expect(flashOpacity(lit.burst! + 1.2, lit)).toBe(0);
  });
});

describe("singleBadgePose", () => {
  it("is born invisible and tiny, then flips to the art and settles", () => {
    const born = singleBadgePose(lit.burst! + CHOREO.birth, lit, geo)!;
    expect(born.opacity).toBe(0);
    expect(born.sx).toBeCloseTo(0.15, 2);
    expect(born.theta).toBe(0);

    const settled = singleBadgePose(lit.ready! + 1, lit, geo)!;
    expect(settled.opacity).toBe(1);
    expect(settled.theta).toBeCloseTo(180, 0);
    expect(settled.sx).toBeCloseTo(1, 2);
    expect(settled.y).toBeCloseTo(geo.center.y, 0);
  });
});

describe("deckBadgePose", () => {
  it("deals each card to its slot in the fan", () => {
    const beats = resolveBeats({ ignitedAt: 2.25, exitAt: null, count: 3 });
    const layout = deckLayout(3, 390, 236);
    const late = beats.ready! + 1;
    layout.fan.forEach((slot, i) => {
      const pose = deckBadgePose(i, late, beats, layout, geo)!;
      expect(pose.x).toBeCloseTo(geo.center.x + slot.dx, 0);
      expect(pose.theta).toBeCloseTo(180, 0);
      expect(pose.tossed).toBe(true);
    });
  });
});

describe("exitBadgePose", () => {
  it("lands on the avatar at the avatar's size", () => {
    const beats = resolveBeats({ ignitedAt: 1.95, exitAt: 6.4, count: 1 });
    const target = { center: { x: 42, y: 76 }, size: 44 };
    const rest = singleBadgePose(6.39, beats, geo)!;
    const end = 6.4 + CHOREO.exit.launch + CHOREO.exit.flight;
    const pose = exitBadgePose(rest, 0, end, beats, flightScale, target);
    expect(pose.x).toBeCloseTo(target.center.x, 0);
    expect(pose.y).toBeCloseTo(target.center.y, 0);
    expect(pose.sx).toBeCloseTo(target.size / geo.size, 2);
    // It fades out over the last few frames of the dive, gone just after touching down.
    expect(exitBadgePose(rest, 0, end + 0.03, beats, flightScale, target).opacity).toBe(0);
  });

  it("folds away in place where there is no avatar", () => {
    const beats = resolveBeats({ ignitedAt: 1.95, exitAt: 6.4, count: 1 });
    const rest = singleBadgePose(6.39, beats, geo)!;
    const pose = exitBadgePose(rest, 0, 6.4 + CHOREO.exit.launch + CHOREO.exit.flight, beats, flightScale, null);
    expect(pose.x).toBe(rest.x);
    expect(pose.opacity).toBe(0);
  });
});

describe("copyPose", () => {
  it("keeps the copy hidden until its beat and shows it all before the ready beat", () => {
    expect(copyPose(lit.copy! - 0.01, lit, 2).eyebrow.opacity).toBe(0);
    const ready = copyPose(lit.ready!, lit, 2);
    expect(ready.eyebrow.opacity).toBeCloseTo(1, 1);
    expect(ready.words.every((w) => w.opacity === 1)).toBe(true);
    expect(ready.ledge.opacity).toBe(1);
  });

  it("sinks the ledge for the press and lets the copy go", () => {
    const beats = resolveBeats({ ignitedAt: 1.95, exitAt: 6.4, count: 1 });
    expect(copyPose(6.45, beats, 2).ledge.pressed).toBe(true);
    expect(copyPose(7, beats, 2).body.opacity).toBe(0);
  });
});
