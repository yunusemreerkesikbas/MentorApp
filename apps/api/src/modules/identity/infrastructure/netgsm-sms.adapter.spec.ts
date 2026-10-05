import { afterEach, describe, expect, it, vi } from "vitest";
import { NetgsmSmsAdapter } from "./netgsm-sms.adapter";

function makeAdapter() {
  const values: Record<string, string> = { SMS_PROVIDER: "netgsm", NETGSM_USERCODE: "8501234567",
    NETGSM_API_PASSWORD: "not-the-admin-password", NETGSM_MSGHEADER: "Mentor" };
  return new NetgsmSmsAdapter({ get: (key: string) => values[key] } as never);
}
afterEach(() => vi.unstubAllGlobals());

describe("Netgsm OTP boundary", () => {
  it.each([300, 600])("uses the REST v2 contract and one ASCII segment at TTL %s, preserving long string ids", async (ttlSeconds) => {
    const jobId = "17377215342605050417149344";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "00", jobid: jobId })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "012345", 5000, ttlSeconds))
      .toEqual({ status: "SENT", jobId });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.netgsm.com.tr/sms/rest/v2/otp");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ msgheader: "Mentor", no: "5321234567", msg: expect.any(String) });
    expect(body.msg).toContain("012345");
    expect(body.msg).toContain(`${ttlSeconds / 60} dakika`);
    expect(body.msg.length).toBeLessThanOrEqual(155);
    expect(/^[\x20-\x7e]+$/.test(body.msg)).toBe(true);
    expect(init.redirect).toBe("error");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json",
      authorization: `Basic ${Buffer.from("8501234567:not-the-admin-password").toString("base64")}` });
  });

  it.each(["20", "30", "40", "41", "50", "51", "52", "60", "70"])("maps definitive rejection %s without exposing provider payload", async (code) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code, message: "+905321234567 private" }))));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "FAILED" });
  });

  it.each(["100", "unexpected"])("retains an unknown outcome for provider code %s", async (code) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code }))));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
  });

  it("does not retry a timeout that may already have sent", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("contains-code-123456-and-credentials"); });
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([400, 406, 429, 500, 502])("does not infer acceptance or retry a non-2xx HTTP response %s", async (status) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "00", jobid: "17377215342605050417149344" }), { status }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts at the configured deadline without a second provider call", async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "123456", 10, 300)).toEqual({ status: "UNKNOWN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].signal!.aborted).toBe(true);
  });

  it.each(["", "   "])("does not accept an empty provider task id: %j", async (jobid) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "00", jobid })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never calls the provider while transport is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new NetgsmSmsAdapter({ get: () => "disabled" } as never);
    expect(await adapter.sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats malformed/ambiguous acceptance conservatively", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not JSON")));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "00", jobid: Number("12345678901234567890") }))));
    expect(await makeAdapter().sendCode("+905321234567", "123456", 5000, 300)).toEqual({ status: "UNKNOWN" });
  });
});
