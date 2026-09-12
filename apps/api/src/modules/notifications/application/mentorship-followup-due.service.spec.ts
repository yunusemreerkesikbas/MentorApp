import { describe, expect, it, vi } from "vitest";
import { EmailTemplate, JobName } from "../domain/notifications.constants";
import { MentorshipFollowupDueService } from "./mentorship-followup-due.service";

const COACH = "11111111-1111-4111-8111-111111111111";
const ISTANBUL_NEXT_DAY = new Date("2026-09-10T21:30:00.000Z");

function setup(dueCount = 2) {
  const followups = {
    listDueCoachIds: vi.fn().mockResolvedValue([COACH]),
    getDueCount: vi.fn().mockResolvedValue(dueCount),
  };
  const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "job-1" }) };
  const notifications = {
    createFromTemplate: vi.fn().mockResolvedValue(true),
  };
  const service = new MentorshipFollowupDueService(
    queue as never,
    followups as never,
    notifications as never,
  );
  return { service, followups, queue, notifications };
}

describe("MentorshipFollowupDueService", () => {
  it("queues one guarded email and creates one Istanbul-day app summary per due coach", async () => {
    const { service, followups, queue, notifications } = setup(2);

    await expect(service.dispatchDaily(ISTANBUL_NEXT_DAY)).resolves.toEqual({
      sent: 1,
      skipped: 0,
    });

    expect(followups.listDueCoachIds).toHaveBeenCalledWith(ISTANBUL_NEXT_DAY);
    expect(followups.getDueCount).toHaveBeenCalledWith(COACH, ISTANBUL_NEXT_DAY);
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_EMAIL, {
      template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
      variables: { count: 2 },
      executionGuard: {
        type: "mentorship-followup-due",
        coachId: COACH,
        dedupeKey: "mentorship-followup-due:2026-09-11",
      },
    });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      COACH,
      "MENTORSHIP",
      "mentorshipFollowupDue",
      "/students",
      {
        args: { count: 2 },
        dedupeKey: "mentorship-followup-due:2026-09-11",
      },
    );
  });

  it("rechecks each candidate and drops a coach whose due work closed before dispatch", async () => {
    const { service, queue, notifications } = setup(0);

    await expect(service.dispatchDaily(ISTANBUL_NEXT_DAY)).resolves.toEqual({
      sent: 0,
      skipped: 1,
    });

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("uses the same dedupe identity when the daily cron is repeated", async () => {
    const { service, queue, notifications } = setup(1);

    await service.dispatchDaily(ISTANBUL_NEXT_DAY);
    await service.dispatchDaily(ISTANBUL_NEXT_DAY);

    const emailKeys = queue.enqueue.mock.calls.map(([, payload]) =>
      payload.executionGuard.dedupeKey,
    );
    const appKeys = notifications.createFromTemplate.mock.calls.map(
      ([, , , , options]) => options.dedupeKey,
    );
    expect(new Set(emailKeys)).toEqual(new Set(["mentorship-followup-due:2026-09-11"]));
    expect(new Set(appKeys)).toEqual(new Set(["mentorship-followup-due:2026-09-11"]));
  });
});
