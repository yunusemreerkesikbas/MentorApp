import { describe, expect, it, vi } from "vitest";

import { JourneyLevelEventsListener } from "./journey-level-events.listener";

describe("JourneyLevelEventsListener", () => {
  it("synchronizes the backend-derived level from an XP change", async () => {
    const celebrations = { synchronizeLive: vi.fn().mockResolvedValue(undefined) };
    const listener = new JourneyLevelEventsListener(celebrations as never);
    const occurredAt = new Date("2026-08-22T14:00:00.000Z");
    const level = {
      tier: 6,
      xp: 1500,
      nextAt: 2200,
      key: "flow",
      chapter: "harmony",
      currentAt: 1500,
      nextKey: "root",
      progress: { current: 0, target: 700, remaining: 700, percent: 0 },
    } as const;

    await listener.onXpChanged({ userId: "user-1", level, occurredAt });

    expect(celebrations.synchronizeLive).toHaveBeenCalledWith("user-1", level, occurredAt);
  });
});
