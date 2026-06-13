import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailTemplate, JobName } from "../../../../shared/notifications/constants";
import { PaymentsEventsListener } from "./payments-events.listener";

describe("PaymentsEventsListener", () => {
  afterEach(() => vi.restoreAllMocks());

  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({ execute: async () => undefined }),
  } as never;

  function makeListener(overrides: { dedupeOk?: boolean; user?: { email: string; displayName: string } | null } = {}) {
    const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "j1" }) };
    const users = {
      getNotificationContact: vi.fn().mockResolvedValue(
        overrides.user === undefined
          ? { email: "pay@test.local", displayName: "Pay" }
          : overrides.user,
      ),
    };
    const deliveries = {
      tryRecord: vi.fn().mockResolvedValue(overrides.dedupeOk ?? true),
    };
    const listener = new PaymentsEventsListener(db, queue as never, users as never, deliveries as never);
    return { listener, queue, deliveries, users };
  }

  it("enqueues dunning email on payment failed", async () => {
    const { listener, queue } = makeListener();
    const graceUntil = new Date("2026-06-15T00:00:00.000Z");
    await listener.onPaymentFailed({
      userId: "u1",
      subscriptionId: "sub-1",
      graceUntil,
    } as never);

    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_EMAIL, {
      to: "pay@test.local",
      template: EmailTemplate.PAYMENT_DUNNING,
      variables: { displayName: "Pay", graceUntil: graceUntil.toISOString() },
    });
  });

  it("skips enqueue when dedupe hits", async () => {
    const { listener, queue } = makeListener({ dedupeOk: false });
    await listener.onPaymentFailed({
      userId: "u1",
      subscriptionId: "sub-1",
      graceUntil: new Date(),
    } as never);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("skips when user not found", async () => {
    const { listener, queue } = makeListener({ user: null });
    await listener.onPaymentFailed({
      userId: "missing",
      subscriptionId: "sub-1",
      graceUntil: new Date(),
    } as never);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("enqueues welcome email on subscription activated", async () => {
    const { listener, queue } = makeListener();
    await listener.onSubscriptionActivated({
      userId: "u1",
      subscriptionId: "sub-2",
      planId: "premium-monthly",
    } as never);
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_EMAIL, {
      to: "pay@test.local",
      template: EmailTemplate.SUBSCRIPTION_WELCOME,
      variables: { displayName: "Pay", planId: "premium-monthly" },
    });
  });
});
