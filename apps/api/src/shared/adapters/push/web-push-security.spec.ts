import { describe, expect, it, vi } from "vitest";
import { pushSubscribeSchema } from "@mentor/validation";
import { WebPushAdapter } from "./web-push.adapter";

const keys = { p256dh: "key", auth: "auth" };

describe("push endpoint security boundary", () => {
  it.each([
    "http://fcm.googleapis.com/fcm/send/token",
    "https://fcm.googleapis.com:8443/fcm/send/token",
    "https://user:password@fcm.googleapis.com/fcm/send/token",
    "https://127.0.0.1/private",
    "https://[::1]/private",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.1/private",
    "https://fcm.googleapis.com.attacker.example/token",
    "https://attacker.example/token",
  ])("rejects an unsafe subscription target: %s", (endpoint) => {
    expect(pushSubscribeSchema.safeParse({ endpoint, keys }).success).toBe(false);
  });

  it.each([
    "https://fcm.googleapis.com/fcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/token",
    "https://wns2-db5p.notify.windows.com/w/?token=test",
  ])("accepts a browser push provider: %s", (endpoint) => {
    expect(pushSubscribeSchema.safeParse({ endpoint, keys }).success).toBe(true);
  });

  it("also rejects persisted unsafe endpoints before any delivery, even in local mode", async () => {
    const adapter = new WebPushAdapter({ get: vi.fn() } as never, {} as never, {} as never);
    await expect(adapter.send({
      endpoint: "https://127.0.0.1/private", keys, title: "Title", body: "Body",
    })).rejects.toThrow();
  });
});
