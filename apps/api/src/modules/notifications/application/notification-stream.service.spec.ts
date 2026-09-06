import { afterEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../../common/errors/domain-error";
import { NotificationStreamService } from "./notification-stream.service";

afterEach(() => vi.useRealTimers());

describe("NotificationStreamService session revocation", () => {
  it("binds a one-time ticket to the exact issuing user and session", () => {
    const service = new NotificationStreamService({} as never);
    const token = service.createStreamToken("user1", "session1");
    expect(service.validateAndConsumeStreamToken(token)).toEqual({ userId: "user1", sessionId: "session1" });
    expect(() => service.validateAndConsumeStreamToken(token)).toThrow(UnauthorizedError);
  });

  it("rejects an expired ticket", () => {
    vi.useFakeTimers();
    const service = new NotificationStreamService({} as never);
    const token = service.createStreamToken("user1", "session1");
    vi.advanceTimersByTime(60_000);
    expect(() => service.validateAndConsumeStreamToken(token)).toThrow(UnauthorizedError);
  });

  it("rejects a valid ticket if its login session was revoked before connection", async () => {
    const validateSession = vi.fn().mockRejectedValue(new UnauthorizedError());
    const service = new NotificationStreamService({ validateSession } as never);
    const token = service.createStreamToken("user1", "session1");
    const principal = service.validateAndConsumeStreamToken(token);
    await expect(service.createStream(principal.userId, principal.sessionId)).rejects.toThrow(UnauthorizedError);
    expect(validateSession).toHaveBeenCalledWith("session1", "user1");
  });

  it("closes a revoked stream at the next heartbeat while another session stays active", async () => {
    vi.useFakeTimers();
    const revoked = new Set<string>();
    const validateSession = vi.fn(async (sessionId: string) => {
      if (revoked.has(sessionId)) throw new UnauthorizedError();
      return { id: "user1", sessionId };
    });
    const service = new NotificationStreamService({ validateSession } as never);
    const closed = vi.fn();
    const events1: unknown[] = [];
    const events2: unknown[] = [];
    const sub1 = (await service.createStream("user1", "session1"))
      .subscribe({ next: (event) => events1.push(event.data), complete: closed });
    const sub2 = (await service.createStream("user1", "session2"))
      .subscribe((event) => events2.push(event.data));
    revoked.add("session1");
    await vi.advanceTimersByTimeAsync(25_000);
    service.pushRealtimeEvent("user1", "new_notification");
    expect(closed).toHaveBeenCalledOnce();
    expect(sub1.closed).toBe(true);
    expect(events1).toEqual([]);
    expect(events2).toEqual(["", { event: "new_notification" }]);
    sub2.unsubscribe();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(validateSession).toHaveBeenCalledTimes(4);
  });
});
