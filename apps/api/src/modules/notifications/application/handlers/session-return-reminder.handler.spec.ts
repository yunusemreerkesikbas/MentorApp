import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryTemplate, JobName } from "../../domain/notifications.constants";
import { SessionReturnReminderHandler } from "./session-return-reminder.handler";

describe("SessionReturnReminderHandler", () => {
  afterEach(() => vi.restoreAllMocks());

  const USER = "11111111-1111-1111-1111-111111111111";
  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({ execute: async () => undefined }),
  } as never;

  it("creates in-app and enqueues push when push enabled", async () => {
    const createInApp = vi.fn().mockResolvedValue(undefined);
    const enqueue = vi.fn().mockResolvedValue({ jobId: "j1" });
    const findByUserIdService = vi.fn().mockResolvedValue({ pushEnabled: true });
    const handler = new SessionReturnReminderHandler(
      db,
      { enqueue } as never,
      { findByUserIdService } as never,
      { createInApp } as never,
    );

    await handler.handle({
      userId: USER,
      linkUrl: "/study-session?subject=Matematik",
      subject: "Matematik",
      targetDate: "2026-07-13",
    });

    expect(createInApp).toHaveBeenCalledWith(
      USER,
      "COACH",
      "Yarınki adımın bekliyor",
      expect.stringContaining("Matematik"),
      "/study-session?subject=Matematik",
    );
    expect(enqueue).toHaveBeenCalledWith(
      JobName.SEND_PUSH,
      expect.objectContaining({
        userId: USER,
        url: "/study-session?subject=Matematik",
        template: DeliveryTemplate.SESSION_RETURN,
        dedupeKey: "session-return-push:2026-07-13",
      }),
    );
  });

  it("skips push when push disabled", async () => {
    const createInApp = vi.fn().mockResolvedValue(undefined);
    const enqueue = vi.fn();
    const handler = new SessionReturnReminderHandler(
      db,
      { enqueue } as never,
      { findByUserIdService: vi.fn().mockResolvedValue({ pushEnabled: false }) } as never,
      { createInApp } as never,
    );

    await handler.handle({
      userId: USER,
      linkUrl: "/study-session",
      subject: null,
      targetDate: "2026-07-13",
    });

    expect(createInApp).toHaveBeenCalledOnce();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
