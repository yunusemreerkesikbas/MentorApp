import { describe, expect, it, vi } from "vitest";
import { SeatEventsListener } from "./seat-events.listener";

function setup() {
  const links = { reseatForUser: vi.fn(async () => undefined) };
  return { links, listener: new SeatEventsListener(links as never) };
}

/**
 * A subscription starting, being cancelled or running out can move seats: the coach's plan sets
 * the paid seats, a student's own subscription decides whether they hold one at all.
 */
describe("SeatEventsListener", () => {
  it.each(["onActivated", "onCanceled", "onExpired", "onPhoneVerified", "onEmailVerified"] as const)(
    "reseats the coaches behind the user on %s",
    async (handler) => {
      const { links, listener } = setup();
      await listener[handler]({ userId: "u1" } as never);
      expect(links.reseatForUser).toHaveBeenCalledWith("u1");
    },
  );

  it("never fails the payment it heard about", async () => {
    const { links, listener } = setup();
    links.reseatForUser.mockRejectedValueOnce(new Error("db down"));
    await expect(listener.onExpired({ userId: "u1" } as never)).resolves.toBeUndefined();
  });
});
