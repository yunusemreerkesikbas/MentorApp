import { describe, expect, it, vi } from "vitest";
import { EmailTemplate } from "../../domain/notifications.constants";
import { SendEmailHandler } from "./send-email.handler";

const COACH = "11111111-1111-4111-8111-111111111111";

function setup(options: {
  dueCount?: number;
  emailEnabled?: boolean;
  claimed?: boolean;
  contact?: { email: string; displayName: string } | null;
  sendError?: Error;
} = {}) {
  const tx = { execute: vi.fn().mockResolvedValue(undefined) };
  const db = {
    transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const email = {
    sendTransactional: vi.fn(async () => {
      if (options.sendError) throw options.sendError;
    }),
  };
  const followups = {
    getDueCount: vi.fn().mockResolvedValue(options.dueCount ?? 3),
  };
  const preferences = {
    findByUserIdService: vi.fn().mockResolvedValue({
      emailEnabled: options.emailEnabled ?? true,
    }),
  };
  const deliveries = {
    tryRecord: vi.fn().mockResolvedValue(options.claimed ?? true),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const users = {
    getNotificationContact: vi.fn().mockResolvedValue(
      options.contact === undefined
        ? { email: "coach@test.local", displayName: "Koç Deniz" }
        : options.contact,
    ),
  };
  const handler = Reflect.construct(SendEmailHandler, [
    email,
    db,
    followups,
    preferences,
    deliveries,
    users,
  ]) as SendEmailHandler;
  return { handler, email, followups, preferences, deliveries, users };
}

const guardedPayload = {
  template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
  variables: { count: 1 },
  executionGuard: {
    type: "mentorship-followup-due" as const,
    coachId: COACH,
    dedupeKey: "mentorship-followup-due:2026-09-12",
  },
};

describe("SendEmailHandler", () => {
  it("keeps legacy unguarded SEND_EMAIL payloads backward compatible", async () => {
    const { handler, email } = setup();

    await handler.handle({
      to: "student@test.local",
      template: "identity.verify-email",
      variables: { displayName: "Ada" },
    });

    expect(email.sendTransactional).toHaveBeenCalledWith({
      to: "student@test.local",
      template: "identity.verify-email",
      variables: { displayName: "Ada" },
    });
  });

  it("rechecks due work and current contact at actual email send time", async () => {
    const { handler, email, followups, users } = setup({ dueCount: 4 });

    await handler.handle(guardedPayload);

    expect(followups.getDueCount).toHaveBeenCalledWith(COACH, expect.any(Date));
    expect(users.getNotificationContact).toHaveBeenCalledWith(COACH);
    expect(email.sendTransactional).toHaveBeenCalledWith({
      to: "coach@test.local",
      template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
      variables: { count: 4, displayName: "Koç Deniz" },
    });
  });

  it("drops a queued email when no OPEN due follow-up remains in the active period", async () => {
    const { handler, email, deliveries } = setup({ dueCount: 0 });

    await handler.handle(guardedPayload);

    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(email.sendTransactional).not.toHaveBeenCalled();
  });

  it("rechecks the coach's email preference at actual send time", async () => {
    const { handler, email, deliveries } = setup({ emailEnabled: false });

    await handler.handle(guardedPayload);

    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(email.sendTransactional).not.toHaveBeenCalled();
  });

  it("sends only once when duplicate daily jobs reach the handler", async () => {
    const { handler, email, deliveries } = setup();
    deliveries.tryRecord
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await handler.handle(guardedPayload);
    await handler.handle(guardedPayload);

    expect(email.sendTransactional).toHaveBeenCalledTimes(1);
  });

  it("releases the delivery claim when the provider fails so the queue retry can send", async () => {
    const failure = new Error("provider unavailable");
    const { handler, deliveries } = setup({ sendError: failure });

    await expect(handler.handle(guardedPayload)).rejects.toThrow("provider unavailable");

    expect(deliveries.release).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: COACH,
        channel: "EMAIL",
        template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
        dedupeKey: "mentorship-followup-due:2026-09-12",
      }),
    );
  });
});
