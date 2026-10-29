import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailAdapter } from "./resend-email.adapter";

function setup() {
  const values: Record<string, string> = {
    RESEND_API_KEY: "re_test_key", RESEND_FROM: "noreply@puhukoc.com",
  };
  const config = { get: (key: string) => values[key] };
  const i18n = { translate: (key: string, options: { lang: string; args: { name: string } }) =>
    key.endsWith("greeting") ? `Hello ${options.args.name}` : `${options.lang}: ${key}` };
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{"id":"email-1"}'));
  vi.stubGlobal("fetch", fetch);
  const adapter = new ResendEmailAdapter(config as never, i18n as never);
  return { adapter, fetch };
}

const input = {
  to: "student@example.test", template: "identity.verify-email",
  variables: { displayName: '<img src=x onerror="alert(1)">', link: "https://puhukoc.com/verify?token=synthetic&lang=tr" },
};

afterEach(() => vi.unstubAllGlobals());

describe("Resend transactional delivery", () => {
  it("sends the existing localized HTML/text through the authenticated Resend API", async () => {
    const { adapter, fetch } = setup();
    await adapter.sendTransactional(input);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer re_test_key" }));
    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({ from: "noreply@puhukoc.com", to: input.to });
    expect(body.subject).toMatch(/^tr:/);
    expect(body.html).toContain("&lt;img");
    expect(body.html).not.toContain("<img");
    expect(body.html).toContain("token=synthetic&amp;lang=tr");
    expect(body.text).toContain(input.variables.link);
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("preserves English password-reset copy and rejects executable links", async () => {
    const { adapter, fetch } = setup();
    await adapter.sendTransactional({ ...input, template: "identity.reset-password",
      variables: { lang: "en-US", link: "javascript:alert(1)" } });
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.subject).toMatch(/^en:/);
    expect(body.html).not.toContain("href=");
    expect(body.text).not.toContain("javascript:");
  });

  it.each([429, 500])("rejects HTTP %s without exposing provider response data", async (status) => {
    const { adapter, fetch } = setup();
    fetch.mockResolvedValue(new Response(JSON.stringify({ message: `${input.to} token=private`, Message: `${input.to} token=private` }), { status }));
    await expect(adapter.sendTransactional(input)).rejects.toThrow(`Resend delivery failed (HTTP ${status})`);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sanitizes network failures instead of exposing request data", async () => {
    const { adapter, fetch } = setup();
    fetch.mockRejectedValue(new Error("request for student@example.test token=private"));
    await expect(adapter.sendTransactional(input)).rejects.toThrow(/^Resend request failed$/);
  });
});
