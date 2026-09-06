import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { isPublicPushAddress, PushEndpointPolicy, UnsafePushEndpointError } from "./push-endpoint-policy";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
const resolveDns = vi.mocked(lookup);
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe("push provider DNS policy", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.100.100.200", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2002:7f00:1::", "2001:db8::1", "224.0.0.1"])("rejects non-public address %s", (address) => {
    expect(isPublicPushAddress(address)).toBe(false);
  });
  it.each(["142.250.1.1", "17.1.2.3", "2607:f8b0:400a:801::200a"])("accepts a public address %s", (address) => {
    expect(isPublicPushAddress(address)).toBe(true);
  });
  it("rejects an allowed provider when any DNS answer is private", async () => {
    resolveDns.mockResolvedValue([{ address: "142.250.1.1", family: 4 }, { address: "10.0.0.1", family: 4 }] as never);
    const policy = new PushEndpointPolicy({ get: vi.fn().mockResolvedValue(1000) } as never);
    await expect(policy.resolve("https://fcm.googleapis.com/fcm/send/token")).rejects.toThrow(UnsafePushEndpointError);
  });
  it("returns one checked address to pin the subsequent HTTPS connection", async () => {
    resolveDns.mockResolvedValue([{ address: "142.250.1.1", family: 4 }] as never);
    const policy = new PushEndpointPolicy({ get: vi.fn().mockResolvedValue(1000) } as never);
    await expect(policy.resolve("https://fcm.googleapis.com/fcm/send/token"))
      .resolves.toMatchObject({ address: "142.250.1.1", family: 4 });
  });
  it("bounds a stalled DNS resolution", async () => {
    vi.useFakeTimers();
    resolveDns.mockImplementation(() => new Promise(() => {}));
    const policy = new PushEndpointPolicy({ get: vi.fn().mockResolvedValue(1000) } as never);
    const result = expect(policy.resolve("https://fcm.googleapis.com/fcm/send/token")).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(1000);
    await result;
  });
});
