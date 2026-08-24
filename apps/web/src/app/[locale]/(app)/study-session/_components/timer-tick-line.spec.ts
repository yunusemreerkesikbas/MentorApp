import { describe, expect, it } from "vitest";
import { TIMER_TICK_COUNT, timerTickLine } from "@mentor/ui";

describe("timerTickLine", () => {
  it("marks hour ticks as major and places 12 o'clock above center", () => {
    const noon = timerTickLine(0, 140, 140, 100);
    expect(TIMER_TICK_COUNT).toBe(60);
    expect(noon.major).toBe(true);
    expect(noon.x1).toBeCloseTo(140);
    expect(noon.y2).toBeLessThan(noon.y1);

    const firstMinor = timerTickLine(1, 140, 140, 100);
    expect(firstMinor.major).toBe(false);
  });
});
