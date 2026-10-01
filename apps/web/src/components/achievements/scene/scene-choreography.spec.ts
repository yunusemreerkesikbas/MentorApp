import { describe, expect, it } from "vitest";
import { AchievementId } from "@mentor/types";

import {
  AUTO_IGNITE_AT,
  CHOREO,
  SCENE_LIGHT,
  deckLayout,
  exitCues,
  exitDuration,
  igniteCues,
  openingCues,
  resolveBeats,
  sparkOrigin,
} from "./scene-choreography";

describe("resolveBeats", () => {
  it("knows nothing after the opening until the light is lit", () => {
    const beats = resolveBeats({ ignitedAt: null, exitAt: null, count: 1 });
    expect(beats.burst).toBeNull();
    expect(beats.copy).toBeNull();
    expect(beats.cards).toBe(1);
  });

  it("hangs the reveal off the ignite", () => {
    const beats = resolveBeats({ ignitedAt: 1.9, exitAt: null, count: 1 });
    expect(beats.burst).toBeCloseTo(1.9 + CHOREO.windup);
    expect(beats.copy).toBeCloseTo(beats.burst! + CHOREO.eyebrow);
    expect(beats.ready!).toBeGreaterThan(beats.copy!);
    expect(beats.quiet!).toBeGreaterThan(beats.ready!);
  });

  it("never lets an early tap ignite before the orb exists", () => {
    expect(resolveBeats({ ignitedAt: 0.2, exitAt: null, count: 1 }).ignite).toBe(CHOREO.orbReady);
  });

  it("lights by itself 1.5 s after the orb is ready", () => {
    expect(AUTO_IGNITE_AT).toBeCloseTo(CHOREO.orbReady + 1.5);
  });

  it("waits for the dealt fan before the copy of a backfill", () => {
    const single = resolveBeats({ ignitedAt: 2, exitAt: null, count: 1 });
    const deck = resolveBeats({ ignitedAt: 2, exitAt: null, count: 3 });
    expect(deck.cards).toBe(3);
    expect(deck.copy!).toBeGreaterThan(single.copy!);
  });

  it("caps the visible cards", () => {
    expect(resolveBeats({ ignitedAt: 2, exitAt: null, count: 12 }).cards).toBe(CHOREO.deck.maxCards);
  });
});

describe("exitDuration", () => {
  it("outlasts the curtain lift and every arrival", () => {
    const single = exitDuration(1);
    expect(single).toBeGreaterThan(CHOREO.exit.curtainLift + CHOREO.exit.curtainDuration);
    expect(exitDuration(3)).toBeCloseTo(single + 2 * CHOREO.exit.stagger);
  });
});

describe("cues", () => {
  it("sorts the ignite cues and keeps the chime on the burst", () => {
    const cues = igniteCues({ cards: 1, byTap: true, copyAfter: 1.3 });
    expect(cues.map((c) => c.at)).toEqual([...cues.map((c) => c.at)].sort((a, b) => a - b));
    const burst = cues.find((c) => c.voice === "burst")!;
    const chime = cues.find((c) => c.voice === "chime")!;
    expect(chime.at - burst.at).toBeCloseTo(0.02);
    expect(cues[0]!.voice).toBe("tap");
  });

  it("drops the tap when the light came on by itself", () => {
    expect(igniteCues({ cards: 1, byTap: false, copyAfter: 1.3 }).some((c) => c.voice === "tap")).toBe(false);
  });

  it("gives every dealt card its own swish and landing", () => {
    const cues = igniteCues({ cards: 3, byTap: false, copyAfter: 2.2 });
    expect(cues.filter((c) => c.voice === "swish")).toHaveLength(3);
    expect(cues.filter((c) => c.voice === "land")).toHaveLength(3);
  });

  it("lands one arrival per badge, the last one loudest", () => {
    const cues = exitCues(3).filter((c) => c.voice === "arrive");
    expect(cues).toHaveLength(3);
    expect(cues[2]!.gain).toBe(1);
    expect(cues.every((c) => c.at < exitDuration(3))).toBe(true);
  });

  it("opens with the spark before the hum", () => {
    const [spark, gather] = openingCues();
    expect(spark!.voice).toBe("spark");
    expect(gather!.at).toBe(CHOREO.orbReady);
  });
});

describe("SCENE_LIGHT", () => {
  it("lights every achievement", () => {
    for (const id of Object.values(AchievementId)) {
      expect(SCENE_LIGHT[id].glow).toMatch(/^#[0-9A-F]{6}$/);
      expect(SCENE_LIGHT[id].alt).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe("sparkOrigin", () => {
  const viewport = { width: 390, height: 844 };

  it("starts from a fresh tap", () => {
    expect(sparkOrigin({ x: 120, y: 400, at: 1_000 }, 3_000, viewport)).toEqual({ x: 120, y: 400 });
  });

  it("comes from beyond the bottom-left once the tap is stale", () => {
    const origin = sparkOrigin({ x: 120, y: 400, at: 0 }, 10_000, viewport);
    expect(origin.x).toBeLessThan(0);
    expect(origin.y).toBeGreaterThan(viewport.height);
    expect(sparkOrigin(null, 0, viewport)).toEqual(origin);
  });
});

describe("deckLayout", () => {
  it("fits the fan inside the stage for every backfill size", () => {
    for (let count = 2; count <= 12; count += 1) {
      const layout = deckLayout(count, 360, 236);
      const half = layout.card / 2;
      const left = Math.min(...layout.fan.map((s) => s.dx - half * s.scale));
      const right = Math.max(...layout.fan.map((s) => s.dx + half * s.scale));
      expect(right - left).toBeLessThanOrEqual(360);
      expect(layout.fan).toHaveLength(layout.cards);
      expect(layout.overflow).toBe(count - layout.cards);
    }
  });

  it("keeps the middle card in front for an odd hand and drops labels when crowded", () => {
    const three = deckLayout(3, 390, 236);
    expect(three.fan[2]!.dx).toBeCloseTo(0);
    expect(three.fan[2]!.scale).toBeGreaterThan(three.fan[0]!.scale);
    expect(three.labels).toBe(true);
    expect(deckLayout(5, 390, 236).labels).toBe(false);
  });
});
