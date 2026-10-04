import { describe, expect, it, vi } from "vitest";
import { RoutingEmailAdapter } from "./routing-email.adapter";

const message = {
  to: "student@example.com",
  template: "identity.reset-password",
  variables: { displayName: "Ada", link: "http://localhost:3000/sifre-sifirla?token=raw-token" },
};

/** `consoleSwitch` answers only the key the router must read; any other key reads undefined. */
function setup(options: { consoleSwitch: boolean[]; postmarkToken?: string }) {
  const answers = [...options.consoleSwitch];
  const registry = {
    get: vi.fn(async (key: string) =>
      key === "dev.email.console_enabled" ? answers.shift() : undefined,
    ),
  };
  const env = {
    get: (key: string) => (key === "POSTMARK_TOKEN" ? options.postmarkToken : undefined),
  };
  const consoleSink = { sendTransactional: vi.fn(async () => undefined) };
  const postmark = { sendTransactional: vi.fn(async () => undefined) };
  const adapter = new RoutingEmailAdapter(
    env as never,
    registry as never,
    consoleSink as never,
    postmark as never,
  );
  return { adapter, consoleSink, postmark };
}

describe("RoutingEmailAdapter", () => {
  it("prints to the console while the switch is on, even with Postmark configured", async () => {
    const { adapter, consoleSink, postmark } = setup({ consoleSwitch: [true], postmarkToken: "t" });

    await adapter.sendTransactional(message);

    expect(consoleSink.sendTransactional).toHaveBeenCalledWith(message);
    expect(postmark.sendTransactional).not.toHaveBeenCalled();
  });

  it("delivers through Postmark when the switch is off and a token is set", async () => {
    const { adapter, consoleSink, postmark } = setup({ consoleSwitch: [false], postmarkToken: "t" });

    await adapter.sendTransactional(message);

    expect(postmark.sendTransactional).toHaveBeenCalledWith(message);
    expect(consoleSink.sendTransactional).not.toHaveBeenCalled();
  });

  it("falls back to the console when no Postmark token is configured", async () => {
    const { adapter, consoleSink, postmark } = setup({ consoleSwitch: [false] });

    await adapter.sendTransactional(message);

    expect(consoleSink.sendTransactional).toHaveBeenCalledWith(message);
    expect(postmark.sendTransactional).not.toHaveBeenCalled();
  });

  it("reads the switch per message, so an admin flip needs no restart", async () => {
    const { adapter, consoleSink, postmark } = setup({
      consoleSwitch: [true, false],
      postmarkToken: "t",
    });

    await adapter.sendTransactional(message);
    await adapter.sendTransactional(message);

    expect(consoleSink.sendTransactional).toHaveBeenCalledTimes(1);
    expect(postmark.sendTransactional).toHaveBeenCalledTimes(1);
  });
});
