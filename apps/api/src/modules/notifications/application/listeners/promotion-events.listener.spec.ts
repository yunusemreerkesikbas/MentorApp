import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscriptionExpired } from "../../../payments/domain/payments.events";
import { JobName } from "../../domain/notifications.constants";
import { PromotionEventsListener } from "./promotion-events.listener";

const OFFER = {
  planId: "premium-monthly",
  listPriceMinor: 24900,
  discountMinor: 4980,
  chargedPriceMinor: 19920,
  renewalPriceMinor: 24900,
  reason: null,
  promotion: {
    code: null,
    label: "Geri dönüş hediyesi",
    discountType: "PERCENT" as const,
    discountValue: 20,
    appliesToPeriods: 1,
    endsAt: null,
  },
};

const EVENT = new SubscriptionExpired("u1", "sub-1", "premium-monthly");

function makeListener(
  options: {
    offer?: typeof OFFER | null;
    campaignsEnabled?: boolean;
    pushEnabled?: boolean;
    dedupeOk?: boolean;
  } = {},
) {
  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) => cb({ execute: async () => undefined }),
  } as never;
  const subscriptions = {
    findWinBackOffer: vi.fn().mockResolvedValue(
      options.offer === undefined ? OFFER : options.offer,
    ),
  };
  const preferences = {
    findByUserIdService: vi.fn().mockResolvedValue({
      campaignsEnabled: options.campaignsEnabled ?? true,
      pushEnabled: options.pushEnabled ?? true,
    }),
  };
  const deliveries = { tryRecord: vi.fn().mockResolvedValue(options.dedupeOk ?? true) };
  const notifications = {
    createFromTemplate: vi.fn().mockResolvedValue(true),
    resolveCopy: vi.fn(() => ({ title: "Aboneliğin sona erdi", body: "…" })),
  };
  const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "j1" }) };
  const listener = new PromotionEventsListener(
    db,
    queue as never,
    subscriptions as never,
    preferences as never,
    deliveries as never,
    notifications as never,
  );
  return { listener, subscriptions, notifications, queue, deliveries, preferences };
}

describe("PromotionEventsListener", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tells a lapsed subscriber about the offer waiting for them", async () => {
    const { listener, notifications, queue } = makeListener();

    await listener.onSubscriptionExpired(EVENT);

    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "u1",
      "SYSTEM",
      "winBackOffer",
      "/subscription",
      expect.objectContaining({ args: { label: "Geri dönüş hediyesi" } }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_PUSH, expect.objectContaining({ userId: "u1" }));
  });

  it("stays silent when no promotion applies", async () => {
    // A commercial message with nothing behind it is spam — better to say nothing.
    const { listener, notifications, queue } = makeListener({ offer: null });

    await listener.onSubscriptionExpired(EVENT);

    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("respects the campaign opt-out on every channel, inbox included", async () => {
    const { listener, notifications, queue } = makeListener({ campaignsEnabled: false });

    await listener.onSubscriptionExpired(EVENT);

    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("writes the inbox row but skips push when push is off", async () => {
    const { listener, notifications, queue } = makeListener({ pushEnabled: false });

    await listener.onSubscriptionExpired(EVENT);

    expect(notifications.createFromTemplate).toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("is idempotent — a replayed event notifies once", async () => {
    const { listener, notifications, queue } = makeListener({ dedupeOk: false });

    await listener.onSubscriptionExpired(EVENT);

    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("never lets a notification failure escape into the emitter", async () => {
    const { listener, subscriptions } = makeListener();
    subscriptions.findWinBackOffer.mockRejectedValueOnce(new Error("boom"));

    await expect(listener.onSubscriptionExpired(EVENT)).resolves.toBeUndefined();
  });
});
