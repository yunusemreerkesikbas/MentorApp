import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanEventReminderOccurrence } from "../../../coaching/domain/coaching-query.port";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { DeliveryTemplate, JobName } from "../../domain/notifications.constants";
import { PlanEventReminderHandler } from "./plan-event-reminder.handler";

const EVENT_ID = "20000000-0000-4000-8000-000000000001";
const ORGANIZER = "10000000-0000-4000-8000-000000000001";
const ATTENDEE_A = "10000000-0000-4000-8000-000000000002";
const ATTENDEE_B = "10000000-0000-4000-8000-000000000003";
const EXPECTED_START_AT = "2026-09-10T07:30:00.000Z";

const db = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: vi.fn() }),
} as never;

function currentOccurrence(
  overrides: Partial<PlanEventReminderOccurrence> = {},
): PlanEventReminderOccurrence {
  return {
    eventId: EVENT_ID,
    organizerUserId: ORGANIZER,
    title: "Haftalık görüşme",
    eventDate: "2026-09-10",
    startTime: "10:30",
    status: "SCHEDULED",
    attendeeUserIds: [ATTENDEE_A, ATTENDEE_B],
    ...overrides,
  };
}

function makeHandler(
  occurrence: PlanEventReminderOccurrence | null = currentOccurrence(),
  preferences: Array<{ userId: string; pushEnabled: boolean }> = [],
) {
  const coaching = {
    getPlanEventReminderOccurrence: vi.fn().mockResolvedValue(occurrence),
  };
  const findByUserIdsService = vi.fn().mockResolvedValue(preferences);
  const notifications = {
    resolveCopy: vi.fn().mockReturnValue({
      title: "Etkinliğin yaklaşıyor",
      body: "Haftalık görüşme, 2026-09-10 10:30",
    }),
    createFromTemplate: vi.fn().mockResolvedValue(true),
  };
  const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "job-1" }) };
  return {
    handler: new PlanEventReminderHandler(
      db,
      coaching as never,
      { findByUserIdsService } as never,
      notifications as never,
      queue as never,
    ),
    coaching,
    findByUserIdsService,
    notifications,
    queue,
  };
}

describe("PlanEventReminderHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T07:00:00.000Z"));
  });

  it.each([
    ["missing", null],
    ["cancelled", currentOccurrence({ status: "CANCELLED" })],
    ["all-day", currentOccurrence({ startTime: null })],
    ["rescheduled", currentOccurrence({ startTime: "11:00" })],
    ["started", currentOccurrence({ startTime: "09:30" })],
  ])("does nothing when the current occurrence is %s", async (_case, occurrence) => {
    const { handler, notifications, queue, findByUserIdsService } =
      makeHandler(occurrence);

    await handler.handle({
      eventId: EVENT_ID,
      expectedStartAt: EXPECTED_START_AT,
    });

    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(findByUserIdsService).not.toHaveBeenCalled();
  });

  it("fans out to the unique organizer and current attendees with one preference read", async () => {
    const { handler, notifications, queue, findByUserIdsService } = makeHandler(
      currentOccurrence({
        attendeeUserIds: [ATTENDEE_A, ORGANIZER, ATTENDEE_B, ATTENDEE_A],
      }),
      [
        { userId: ATTENDEE_A, pushEnabled: false },
        { userId: ATTENDEE_B, pushEnabled: true },
      ],
    );

    await handler.handle({
      eventId: EVENT_ID,
      expectedStartAt: EXPECTED_START_AT,
    });

    const recipients = [ORGANIZER, ATTENDEE_A, ATTENDEE_B];
    expect(findByUserIdsService).toHaveBeenCalledOnce();
    expect(findByUserIdsService).toHaveBeenCalledWith(
      expect.anything(),
      recipients,
    );
    expect(notifications.createFromTemplate).toHaveBeenCalledTimes(3);
    for (const recipient of recipients) {
      const dedupeKey = `plan-event:${EVENT_ID}:${recipient}:${EXPECTED_START_AT}`;
      expect(notifications.createFromTemplate).toHaveBeenCalledWith(
        recipient,
        "PLAN",
        NotificationCopyKey.PLAN_EVENT_REMINDER,
        `/plan?date=2026-09-10&event=${EVENT_ID}`,
        {
          args: {
            eventTitle: "Haftalık görüşme",
            eventDate: "2026-09-10",
            eventTime: "10:30",
          },
          dedupeKey,
        },
      );
    }
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    expect(queue.enqueue).toHaveBeenCalledWith(
      JobName.SEND_PUSH,
      expect.objectContaining({
        userId: ORGANIZER,
        template: DeliveryTemplate.PLAN_EVENT_REMINDER,
        dedupeKey: `plan-event:${EVENT_ID}:${ORGANIZER}:${EXPECTED_START_AT}`,
      }),
    );
    expect(queue.enqueue).not.toHaveBeenCalledWith(
      JobName.SEND_PUSH,
      expect.objectContaining({ userId: ATTENDEE_A }),
    );
  });

  it("reuses stable in-app and push dedupe keys on a job retry", async () => {
    const { handler, notifications, queue } = makeHandler(
      currentOccurrence({ attendeeUserIds: [ATTENDEE_A] }),
    );
    const payload = {
      eventId: EVENT_ID,
      expectedStartAt: EXPECTED_START_AT,
    };

    await handler.handle(payload);
    await handler.handle(payload);

    const inAppKeys = notifications.createFromTemplate.mock.calls.map(
      (call) => call[4]?.dedupeKey,
    );
    const pushKeys = queue.enqueue.mock.calls.map(
      (call) => call[1]?.dedupeKey,
    );
    expect(new Set(inAppKeys)).toEqual(
      new Set([
        `plan-event:${EVENT_ID}:${ORGANIZER}:${EXPECTED_START_AT}`,
        `plan-event:${EVENT_ID}:${ATTENDEE_A}:${EXPECTED_START_AT}`,
      ]),
    );
    expect(new Set(pushKeys)).toEqual(new Set(inAppKeys));
  });

  it("loads current event recipients through the coaching query seam only", async () => {
    const { handler, coaching } = makeHandler();

    await handler.handle({
      eventId: EVENT_ID,
      expectedStartAt: EXPECTED_START_AT,
    });

    expect(coaching.getPlanEventReminderOccurrence).toHaveBeenCalledOnce();
    expect(coaching.getPlanEventReminderOccurrence).toHaveBeenCalledWith(
      EVENT_ID,
    );
  });

  it("compares expected start values as instants instead of ISO spellings", async () => {
    const { handler, notifications } = makeHandler();

    await handler.handle({
      eventId: EVENT_ID,
      expectedStartAt: "2026-09-10T10:30:00.000+03:00",
    });

    expect(notifications.createFromTemplate).toHaveBeenCalled();
  });
});
