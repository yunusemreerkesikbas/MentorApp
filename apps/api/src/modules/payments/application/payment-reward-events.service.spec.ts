import { describe, expect, it, vi } from "vitest";
import { PaymentRewardEventsService } from "./payment-reward-events.service";
import { PaymentSucceeded, PaymentsEventTopic } from "../domain/payments.events";

describe("PaymentRewardEventsService", () => {
  it("uses the payment transaction and restores dates after JSON queue serialization", async () => {
    const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "job" }) };
    const runner = { registerHandler: vi.fn() };
    const events = { emitAsync: vi.fn().mockResolvedValue([]) };
    const service = new PaymentRewardEventsService(queue as never, runner as never, events as never);
    const event = new PaymentSucceeded("10000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001", "pay-1", 100, new Date("2026-09-13T23:59:00Z"));
    const transaction = {} as never;
    await service.append(event, transaction);
    expect(queue.enqueue).toHaveBeenCalledWith("payments.deliver-reward-event",
      { topic: PaymentsEventTopic.PAYMENT_SUCCEEDED, event }, { transaction });
    service.onModuleInit();
    const handler = runner.registerHandler.mock.calls[0]![1];
    await handler(JSON.parse(JSON.stringify(queue.enqueue.mock.calls[0]![1])));
    expect(events.emitAsync).toHaveBeenCalledWith(PaymentsEventTopic.PAYMENT_SUCCEEDED, event);
    events.emitAsync.mockRejectedValueOnce(new Error("economy unavailable"));
    await expect(handler(JSON.parse(JSON.stringify(queue.enqueue.mock.calls[0]![1]))))
      .rejects.toThrow("economy unavailable");
  });
});
