import { describe, expect, it, vi } from "vitest";
import { InvalidMobilePushTokenError } from "../../../../shared/ports/mobile-push.port";
import { SendPushHandler } from "./send-push.handler";

const data = {
  userId: "10000000-0000-4000-8000-000000000001",
  title: "Title",
  body: "Body",
  template: "reminder",
  dedupeKey: "today",
};

function makeHandler(overrides?: {
  webSend?: ReturnType<typeof vi.fn>;
  mobileSend?: ReturnType<typeof vi.fn>;
  webSubs?: unknown[];
  expoTokens?: unknown[];
  deleteWeb?: ReturnType<typeof vi.fn>;
  deleteMobile?: ReturnType<typeof vi.fn>;
}) {
  let inTransaction = false;
  const db = {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      inTransaction = true;
      try {
        return await fn({ execute: vi.fn() });
      } finally {
        inTransaction = false;
      }
    }),
  };
  const webSend = overrides?.webSend ?? vi.fn();
  const mobileSend = overrides?.mobileSend ?? vi.fn();
  const deleteWeb = overrides?.deleteWeb ?? vi.fn();
  const deleteMobile = overrides?.deleteMobile ?? vi.fn();
  const deliveries = {
    exists: vi.fn().mockResolvedValue(false),
    tryRecord: vi.fn().mockResolvedValue(true),
  };
  const claims = {
    claim: vi.fn().mockResolvedValue("claimed"),
    release: vi.fn(),
    complete: vi.fn(),
  };

  const handler = new SendPushHandler(
    db as never,
    { send: webSend } as never,
    {
      listByUserId: vi.fn().mockResolvedValue(overrides?.webSubs ?? []),
      deleteByEndpoint: deleteWeb,
    } as never,
    deliveries as never,
    claims as never,
    { get: vi.fn().mockResolvedValue(10_000) } as never,
    { send: mobileSend } as never,
    {
      listByUserId: vi.fn().mockResolvedValue(overrides?.expoTokens ?? []),
      deleteByToken: deleteMobile,
    } as never,
  );

  return {
    handler,
    webSend,
    mobileSend,
    deleteWeb,
    deleteMobile,
    deliveries,
    claims,
    isInTransaction: () => inTransaction,
  };
}

describe("SendPushHandler network boundaries", () => {
  it("propagates transient failures so the queue can retry, without holding a transaction", async () => {
    let seenInTx = true;
    const h = makeHandler({
      webSubs: [{ id: "sub1", endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "k", auth: "a" }],
    });
    h.webSend.mockImplementation(async () => {
      seenInTx = h.isInTransaction();
      throw new Error("temporary provider failure");
    });

    await expect(h.handler.handle(data)).rejects.toThrow("temporary provider failure");
    expect(seenInTx).toBe(false);
    expect(h.webSend).toHaveBeenCalledOnce();
    expect(h.claims.release).toHaveBeenCalledOnce();
  });

  it("records no delivery for a user without web or mobile targets, so a later subscriber is reached", async () => {
    const h = makeHandler({ webSubs: [], expoTokens: [] });

    await h.handler.handle(data);

    expect(h.webSend).not.toHaveBeenCalled();
    expect(h.mobileSend).not.toHaveBeenCalled();
    expect(h.deliveries.tryRecord).not.toHaveBeenCalled();
  });

  it("delivers to Expo push tokens outside transactions and records delivery", async () => {
    let seenInTx = true;
    const token = "ExponentPushToken[abcdefghijklmnopqrstuv]";
    const h = makeHandler({
      expoTokens: [{ id: "m1", token, platform: "android" }],
    });
    h.mobileSend.mockImplementation(async () => {
      seenInTx = h.isInTransaction();
    });

    await h.handler.handle({ ...data, url: "/plan" });

    expect(seenInTx).toBe(false);
    expect(h.mobileSend).toHaveBeenCalledWith({
      token,
      title: "Title",
      body: "Body",
      url: "/plan",
    });
    expect(h.claims.complete).toHaveBeenCalledOnce();
    expect(h.deliveries.tryRecord).toHaveBeenCalledOnce();
  });

  it("prunes DeviceNotRegistered mobile tokens without retrying forever", async () => {
    const staleToken = "ExponentPushToken[stale_device_token_1234]";
    const h = makeHandler({
      expoTokens: [{ id: "m1", token: staleToken, platform: "ios" }],
      mobileSend: vi.fn().mockRejectedValue(new InvalidMobilePushTokenError()),
    });

    await h.handler.handle(data);

    expect(h.deleteMobile).toHaveBeenCalledWith(expect.anything(), data.userId, staleToken);
    expect(h.claims.complete).toHaveBeenCalledOnce();
    expect(h.claims.release).not.toHaveBeenCalled();
    expect(h.deliveries.tryRecord).toHaveBeenCalledOnce();
  });

  it("releases claim and rethrows on transient mobile push failure", async () => {
    const token = "ExponentPushToken[transient_retry_12345]";
    const h = makeHandler({
      expoTokens: [{ id: "m1", token, platform: "android" }],
      mobileSend: vi.fn().mockRejectedValue(new Error("Expo 503")),
    });

    await expect(h.handler.handle(data)).rejects.toThrow("Expo 503");

    expect(h.deleteMobile).not.toHaveBeenCalled();
    expect(h.claims.release).toHaveBeenCalledOnce();
    expect(h.deliveries.tryRecord).not.toHaveBeenCalled();
  });
});
