import { describe, expect, it, vi } from "vitest";

import { REALTIME_QUEUE_TTL_MS } from "../notifications.service";
import { JourneyLevelEventsListener } from "./journey-level-events.listener";

describe("notifications JourneyLevelEventsListener", () => {
  it("pushes only a realtime refresh cue without creating a bell notification", () => {
    const notifications = {
      pushRealtimeEvent: vi.fn(),
      createInApp: vi.fn(),
    };
    const listener = new JourneyLevelEventsListener(notifications as never);

    listener.onUnlocked({
      celebrationId: "10000000-0000-4000-8000-000000000001",
      userId: "user-1",
      tier: 6,
      unlockedAt: new Date("2026-08-22T14:00:00.000Z"),
    });

    expect(notifications.pushRealtimeEvent).toHaveBeenCalledWith(
      "user-1",
      "journey_level_unlocked",
      { celebrationId: "10000000-0000-4000-8000-000000000001", tier: 6 },
      REALTIME_QUEUE_TTL_MS,
    );
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });
});
