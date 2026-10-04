import { describe, expect, it, vi } from "vitest";
import { PaymentRefunded } from "../../payments/domain/payments.events";
import { RefundEventsListener } from "./refund-events.listener";

describe("RefundEventsListener", () => {
  it("always reverses the invite reward, even when economy is later switched off", async () => {
    const invites = { onInvitedRefunded: vi.fn().mockResolvedValue(undefined) };
    const listener = new RefundEventsListener(invites as never);
    const event = new PaymentRefunded(
      "10000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001",
      50,
      "pay-1",
    );
    await listener.onPaymentRefunded(event);
    expect(invites.onInvitedRefunded).toHaveBeenCalledWith(event.userId, "pay-1");
  });
});
