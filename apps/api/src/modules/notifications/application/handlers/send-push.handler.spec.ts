import { describe, expect, it, vi } from "vitest";
import { SendPushHandler } from "./send-push.handler";

const data = {
  userId: "10000000-0000-4000-8000-000000000001",
  title: "Title", body: "Body", template: "reminder", dedupeKey: "today",
};

describe("SendPushHandler network boundaries", () => {
  it("propagates transient failures so the queue can retry, without holding a transaction", async () => {
    let inTransaction = false;
    const db = { transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      inTransaction = true;
      try { return await fn({ execute: vi.fn() }); }
      finally { inTransaction = false; }
    }) };
    const send = vi.fn(async () => {
      expect(inTransaction).toBe(false);
      throw new Error("temporary provider failure");
    });
    const handler = new SendPushHandler(db as never, { send }, {
      listByUserId: vi.fn().mockResolvedValue([{ id: "sub1", endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "k", auth: "a" }]),
    } as never,
    { exists: vi.fn().mockResolvedValue(false), tryRecord: vi.fn().mockResolvedValue(true) } as never,
    { claim: vi.fn().mockResolvedValue("claimed"), release: vi.fn(), complete: vi.fn() } as never,
    { get: vi.fn().mockResolvedValue(10_000) } as never);
    await expect(handler.handle(data)).rejects.toThrow("temporary provider failure");
    expect(send).toHaveBeenCalledOnce();
  });
});
