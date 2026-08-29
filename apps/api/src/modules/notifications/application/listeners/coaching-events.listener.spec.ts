import { describe, expect, it, vi } from "vitest";
import {
  DailyPlanCompleted,
  FirstSessionOfDay,
  MoodLow,
} from "../../../coaching/domain/coaching.events";
import { CoachingEventsListener } from "./coaching-events.listener";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function makeListener() {
  const createFromTemplate = vi.fn(async () => undefined);
  return {
    createFromTemplate,
    listener: new CoachingEventsListener(
      { createFromTemplate } as never,
      fakeDb,
      { tryRecord: vi.fn(async () => true) } as never,
    ),
  };
}

describe("CoachingEventsListener deep-links", () => {
  it("routes low mood and completed plan notifications to the dashboard", async () => {
    const { listener, createFromTemplate } = makeListener();
    await listener.onMoodLow(new MoodLow("u1", 2));
    await listener.onPlanCompleted(new DailyPlanCompleted("u1", 3));

    expect(createFromTemplate.mock.calls[0]?.[3]).toBe("/dashboard");
    expect(createFromTemplate.mock.calls[1]?.[3]).toBe("/dashboard");
  });

  it("keeps the first-session continuation on study-session", async () => {
    const { listener, createFromTemplate } = makeListener();
    await listener.onFirstSession(new FirstSessionOfDay("u1"));
    expect(createFromTemplate.mock.calls[0]?.[3]).toBe("/study-session");
  });
});
