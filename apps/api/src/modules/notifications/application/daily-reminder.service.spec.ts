import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailTemplate, JobName } from "../../../shared/notifications/constants";
import { DailyReminderService } from "./daily-reminder.service";

describe("DailyReminderService", () => {
  afterEach(() => vi.restoreAllMocks());

  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({ execute: async () => undefined }),
  } as never;

  function makeService(overrides: {
    candidates?: Array<{ userId: string; email: string; displayName: string }>;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    emailDedupeOk?: boolean;
  } = {}) {
    const coaching = {
      listDailyReminderCandidates: vi.fn().mockResolvedValue(
        overrides.candidates ?? [
          { userId: "u1", email: "a@test.local", displayName: "Ada" },
        ],
      ),
    };
    const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "j1" }) };
    const preferences = {
      findByUserIdService: vi.fn().mockResolvedValue({
        emailEnabled: overrides.emailEnabled ?? true,
        pushEnabled: overrides.pushEnabled ?? true,
      }),
    };
    const deliveries = {
      tryRecord: vi.fn().mockResolvedValue(overrides.emailDedupeOk ?? true),
    };

    const service = new DailyReminderService(
      db,
      queue as never,
      coaching as never,
      preferences as never,
      deliveries as never,
    );
    return { service, queue, deliveries, preferences };
  }

  it("skips users with both channels disabled", async () => {
    const { service, queue } = makeService({ emailEnabled: false, pushEnabled: false });
    const result = await service.dispatchForToday();
    expect(result.skipped).toBe(1);
    expect(result.enqueued).toBe(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("enqueues email and push when eligible", async () => {
    const { service, queue } = makeService();
    const result = await service.dispatchForToday();
    expect(result.skipped).toBe(0);
    expect(result.enqueued).toBe(2);
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_EMAIL, expect.objectContaining({
      to: "a@test.local",
      template: EmailTemplate.DAILY_REMINDER,
    }));
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_PUSH, expect.objectContaining({
      userId: "u1",
    }));
  });

  it("does not enqueue email when dedupe hits", async () => {
    const { service, queue } = makeService({ emailDedupeOk: false, pushEnabled: false });
    await service.dispatchForToday();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
