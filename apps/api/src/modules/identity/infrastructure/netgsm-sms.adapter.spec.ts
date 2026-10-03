import { afterEach, describe, expect, it, vi } from "vitest";
import { NetgsmSmsAdapter } from "./netgsm-sms.adapter";

function makeAdapter() {
  const values: Record<string, string> = { SMS_PROVIDER: "netgsm", NETGSM_USERCODE: "api-sub-user",
    NETGSM_API_PASSWORD: "not-the-admin-password", NETGSM_MSGHEADER: "Mentor" };
  return new NetgsmSmsAdapter({ get: (key: string) => values[key] } as never);
}
afterEach(() => vi.unstubAllGlobals());

describe("Netgsm OTP boundary", () => {
  it("uses a single ASCII OTP SMS and preserves long provider ids as strings", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "00", jobid: "12345678901234567890" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "012345", 5000, 300))
      .toEqual({ status: "SENT", jobId: "12345678901234567890" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.netgsm.com.tr/sms/rest/v2/otp");
    const body = JSON.parse(String(init.body));
    expect(body.no).toBe("5321234567");
    expect(body.msg).toContain("012345");
    expect(body.msg.length).toBeLessThanOrEqual(155);
    expect(/^[\x20-\x7e]+$/.test(body.msg)).toBe(true);
    expect(init.redirect).toBe("error");
  });

  it.each(["30", "40", "41", "50", "51", "52", "60"])("maps definitive rejection %s without exposing provider payload", async (code) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code, message: "+905321234567 private" }))));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "FAILED" });
  });

  it("does not retry a timeout that may already have sent", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("contains-code-123456-and-credentials"); });
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats malformed/ambiguous acceptance conservatively", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not JSON")));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "00", jobid: 12345678901234567890 }))));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
  });
});
