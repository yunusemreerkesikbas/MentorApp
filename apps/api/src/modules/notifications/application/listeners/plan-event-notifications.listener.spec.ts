import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlanEventCancelled,
  PlanEventCreated,
  PlanEventUpdated,
  type PlanEventOccurrencePayload,
} from "../../../coaching/domain/coaching.events";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { JobName } from "../../domain/notifications.constants";
import { PlanEventNotificationsListener } from "./plan-event-notifications.listener";

const ORGANIZER = "10000000-0000-4000-8000-000000000001";
const ATTENDEE_A = "10000000-0000-4000-8000-000000000002";
const ATTENDEE_B = "10000000-0000-4000-8000-000000000003";

function occurrence(
  overrides: Partial<PlanEventOccurrencePayload> = {},
): PlanEventOccurrencePayload {
  return {
    eventId: "20000000-0000-4000-8000-000000000001",
    title: "Haftalık görüşme",
    eventDate: "2026-09-10",
    startTime: "10:30",
    status: "SCHEDULED",
    recipientUserIds: [ATTENDEE_A],
    ...overrides,
  };
}

function makeListener() {
  const notifications = {
    createFromTemplate: vi.fn().mockResolvedValue(true),
  };
  const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "job-1" }) };
  return {
    listener: new PlanEventNotificationsListener(
      notifications as never,
      queue as never,
    ),
    notifications,
    queue,
  };
}

describe("PlanEventNotificationsListener", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T07:00:00.000Z"));
  });

  it("creates one series summary per attendee using their first affected occurrence", async () => {
    const { listener, notifications } = makeListener();
    const first = occurrence({
      eventDate: "2026-09-17",
      recipientUserIds: [ATTENDEE_A],
    });
    const earlier = occurrence({
      eventId: "20000000-0000-4000-8000-000000000002",
      eventDate: "2026-09-10",
      recipientUserIds: [ATTENDEE_B, ORGANIZER],
    });
    const latest = occurrence({
      eventId: "20000000-0000-4000-8000-000000000003",
      eventDate: "2026-09-24",
      recipientUserIds: [ATTENDEE_A, ATTENDEE_B],
    });

    await listener.onCreated(
      new PlanEventCreated(ORGANIZER, [first, latest, earlier]),
    );

    expect(notifications.createFromTemplate).toHaveBeenCalledTimes(2);
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      ATTENDEE_A,
      "PLAN",
      NotificationCopyKey.PLAN_EVENT_CREATED,
      `/plan?date=${first.eventDate}&event=${first.eventId}`,
      {
        args: {
          eventTitle: first.title,
          eventDate: first.eventDate,
          eventTime: first.startTime,
        },
      },
    );
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      ATTENDEE_B,
      "PLAN",
      NotificationCopyKey.PLAN_EVENT_CREATED,
      `/plan?date=${earlier.eventDate}&event=${earlier.eventId}`,
      expect.objectContaining({
        args: expect.objectContaining({ eventTitle: earlier.title }),
      }),
    );
    expect(
      notifications.createFromTemplate.mock.calls.some(
        ([recipient]) => recipient === ORGANIZER,
      ),
    ).toBe(false);
  });

  it("schedules timed created and updated occurrences but omits all-day and cancelled ones", async () => {
    const { listener, queue } = makeListener();
    const timed = occurrence();
    const allDay = occurrence({
      eventId: "20000000-0000-4000-8000-000000000002",
      startTime: null,
    });

    await listener.onCreated(
      new PlanEventCreated(ORGANIZER, [allDay, timed]),
    );
    await listener.onUpdated(
      new PlanEventUpdated(ORGANIZER, [timed]),
    );
    await listener.onCancelled(
      new PlanEventCancelled(ORGANIZER, [timed]),
    );

    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    expect(queue.enqueue).toHaveBeenNthCalledWith(
      1,
      JobName.PLAN_EVENT_REMINDER,
      {
        eventId: timed.eventId,
        expectedStartAt: "2026-09-10T07:30:00.000Z",
      },
      { runAt: new Date("2026-09-10T07:15:00.000Z") },
    );
    expect(queue.enqueue).toHaveBeenNthCalledWith(
      2,
      JobName.PLAN_EVENT_REMINDER,
      expect.objectContaining({ eventId: timed.eventId }),
      expect.any(Object),
    );
  });

  it("does not schedule a timed cancelled occurrence carried by an updated event", async () => {
    const { listener, queue } = makeListener();

    await listener.onUpdated(
      new PlanEventUpdated(ORGANIZER, [
        occurrence({ status: "CANCELLED" }),
      ]),
    );

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("selects localized all-day lifecycle templates without a time argument", async () => {
    const { listener, notifications } = makeListener();
    const event = occurrence({ startTime: null });

    await listener.onCreated(new PlanEventCreated(ORGANIZER, [event]));
    await listener.onUpdated(new PlanEventUpdated(ORGANIZER, [event]));
    await listener.onCancelled(new PlanEventCancelled(ORGANIZER, [event]));

    expect(notifications.createFromTemplate.mock.calls.map((call) => call[2])).toEqual([
      NotificationCopyKey.PLAN_EVENT_CREATED_ALL_DAY,
      NotificationCopyKey.PLAN_EVENT_UPDATED_ALL_DAY,
      NotificationCopyKey.PLAN_EVENT_CANCELLED_ALL_DAY,
    ]);
    for (const call of notifications.createFromTemplate.mock.calls) {
      expect(call[4]?.args).toEqual({
        eventTitle: event.title,
        eventDate: event.eventDate,
      });
    }
  });

  it("uses operation-specific copy without carrying attendee identities in stored data", async () => {
    const { listener, notifications } = makeListener();
    const event = occurrence();

    await listener.onUpdated(new PlanEventUpdated(ORGANIZER, [event]));
    await listener.onCancelled(new PlanEventCancelled(ORGANIZER, [event]));

    expect(notifications.createFromTemplate.mock.calls[0]?.[2]).toBe(
      NotificationCopyKey.PLAN_EVENT_UPDATED,
    );
    expect(notifications.createFromTemplate.mock.calls[1]?.[2]).toBe(
      NotificationCopyKey.PLAN_EVENT_CANCELLED,
    );
    for (const call of notifications.createFromTemplate.mock.calls) {
      expect(JSON.stringify(call.slice(2))).not.toContain(ATTENDEE_B);
      expect(call[4]).not.toHaveProperty("data");
    }
  });

  it("absorbs delivery and scheduling failures after the coaching transaction", async () => {
    const notifications = {
      createFromTemplate: vi.fn().mockRejectedValue(new Error("in-app down")),
    };
    const queue = {
      enqueue: vi.fn().mockRejectedValue(new Error("queue down")),
    };
    const listener = new PlanEventNotificationsListener(
      notifications as never,
      queue as never,
    );

    await expect(
      listener.onCreated(new PlanEventCreated(ORGANIZER, [occurrence()])),
    ).resolves.toBeUndefined();
  });
});
