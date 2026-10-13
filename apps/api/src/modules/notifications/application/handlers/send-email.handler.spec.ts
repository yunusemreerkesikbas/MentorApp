import { describe, expect, it, vi } from "vitest";
import { CONFIG_CATALOG } from "../../../../common/config/config.catalog";
import { EmailTemplate } from "../../domain/notifications.constants";
import { SendEmailHandler } from "./send-email.handler";

const COACH = "11111111-1111-4111-8111-111111111111";

function setup(options: {
  dueCount?: number;
  emailEnabled?: boolean;
  claimed?: boolean;
  contact?: { email: string; displayName: string } | null;
  sendError?: Error;
  dailyEmailEnabled?: boolean;
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
    getNotificationContact: vi.fn().mockResolvedValue({ email: "new-unverified@test.local", displayName: "Coach" }),
    getVerifiedNotificationContact: vi.fn().mockResolvedValue(
      options.contact === undefined
        ? { email: "coach@test.local", displayName: "Koç Deniz" }
        : options.contact,
    ),
  };
  const auth = { deliverCurrentEmailToken: vi.fn(async (_hash: string, _to: string, deliver: () => Promise<void>) => deliver()) };
  const registry = { get: vi.fn().mockResolvedValue(
    options.dailyEmailEnabled ?? CONFIG_CATALOG["notifications.daily_reminder.email_enabled"].default,
  ) };
  const handler = Reflect.construct(SendEmailHandler, [
    email,
    db,
    followups,
    preferences,
    deliveries,
    users,
    auth,
    registry,
  ]) as SendEmailHandler;
  return { handler, email, followups, preferences, deliveries, users, auth, registry };
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
  it("suppresses a previously queued daily email after reminder email is paused", async () => {
    const { handler, email, registry } = setup({ dailyEmailEnabled: false });
    await handler.handle({ to: "student@test.local", template: EmailTemplate.DAILY_REMINDER });
    expect(email.sendTransactional).not.toHaveBeenCalled();
    expect(registry.get).toHaveBeenCalledWith("notifications.daily_reminder.email_enabled");
  });

  it("delivers a queued daily email when the reminder channel remains enabled", async () => {
    const { handler, email } = setup();
    await handler.handle({ to: "student@test.local", template: EmailTemplate.DAILY_REMINDER });
    expect(email.sendTransactional).toHaveBeenCalledWith(expect.objectContaining({ template: EmailTemplate.DAILY_REMINDER }));
  });

  it.each([EmailTemplate.VERIFY_EMAIL, EmailTemplate.RESET_PASSWORD])("keeps %s outside the reminder pause", async (template) => {
    const { handler, email, auth, registry } = setup({ dailyEmailEnabled: false });
    const executionGuard = { type: "identity-email-token", tokenHash: "a".repeat(64) };
    await handler.handle({ to: "student@test.local", template, executionGuard });
    expect(auth.deliverCurrentEmailToken).toHaveBeenCalledOnce();
    expect(email.sendTransactional).toHaveBeenCalledWith(expect.objectContaining({ template }));
    expect(registry.get).not.toHaveBeenCalled();
  });

  it("suppresses due email when a coach changes email after due-count verification", async () => {
    const { handler, users, email, deliveries } = setup({ contact: null });
    await handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"));
    expect(users.getVerifiedNotificationContact).toHaveBeenCalledWith(COACH);
    expect(users.getNotificationContact).not.toHaveBeenCalled();
    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(email.sendTransactional).not.toHaveBeenCalled();
  });

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

    await handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"));

    expect(followups.getDueCount).toHaveBeenCalledWith(COACH, expect.any(Date));
    expect(users.getVerifiedNotificationContact).toHaveBeenCalledWith(COACH);
    expect(email.sendTransactional).toHaveBeenCalledWith({
      to: "coach@test.local",
      template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
      variables: { count: 4, displayName: "Koç Deniz" },
    });
  });

  it("drops a queued email when no OPEN due follow-up remains in the active period", async () => {
    const { handler, email, deliveries } = setup({ dueCount: 0 });

    await handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"));

    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(email.sendTransactional).not.toHaveBeenCalled();
  });

  it("rechecks the coach's email preference at actual send time", async () => {
    const { handler, email, deliveries } = setup({ emailEnabled: false });

    await handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"));

    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(email.sendTransactional).not.toHaveBeenCalled();
  });

  it("sends only once when duplicate daily jobs reach the handler", async () => {
    const { handler, email, deliveries } = setup();
    deliveries.tryRecord
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"));
    await handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"));

    expect(email.sendTransactional).toHaveBeenCalledTimes(1);
  });

  it("releases the delivery claim when the provider fails so the queue retry can send", async () => {
    const failure = new Error("provider unavailable");
    const { handler, deliveries } = setup({ sendError: failure });

    await expect(handler.handle(guardedPayload, new Date("2026-09-12T07:00:00Z"))).rejects.toThrow("provider unavailable");

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

it("drops a previous-day summary instead of sending two summaries today", async () => {
  const { handler, email, followups } = setup();
  await handler.handle(guardedPayload, new Date("2026-09-13T07:00:00Z"));
  expect(followups.getDueCount).not.toHaveBeenCalled();
  expect(email.sendTransactional).not.toHaveBeenCalled();
});
