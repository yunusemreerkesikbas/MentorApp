import { describe, expect, it, vi } from "vitest";
import { RoutingEmailAdapter } from "./routing-email.adapter";

const message = {
  to: "student@example.com",
  template: "identity.reset-password",
  variables: { displayName: "Ada", link: "http://localhost:3000/sifre-sifirla?token=raw-token" },
};

/** `consoleSwitch` answers only the key the router must read; any other key reads undefined. */
function setup(options: { consoleSwitch: boolean[]; resendKey?: string }) {
  const answers = [...options.consoleSwitch];
  const registry = {
    get: vi.fn(async (key: string) =>
      key === "dev.email.console_enabled" ? answers.shift() : undefined,
    ),
  };
  const env = {
    get: (key: string) => (key === "RESEND_API_KEY" ? options.resendKey : undefined),
  };
  const consoleSink = { sendTransactional: vi.fn(async () => undefined) };
  const resend = { sendTransactional: vi.fn(async () => undefined) };
  const adapter = new RoutingEmailAdapter(
    env as never,
    registry as never,
    consoleSink as never,
    resend as never,
  );
  return { adapter, consoleSink, resend };
}

describe("RoutingEmailAdapter", () => {
  it("prints to the console while the switch is on, even with Resend configured", async () => {
    const { adapter, consoleSink, resend } = setup({ consoleSwitch: [true], resendKey: "t" });

    await adapter.sendTransactional(message);

    expect(consoleSink.sendTransactional).toHaveBeenCalledWith(message);
    expect(resend.sendTransactional).not.toHaveBeenCalled();
  });

  it("delivers through Resend when the switch is off and a token is set", async () => {
    const { adapter, consoleSink, resend } = setup({ consoleSwitch: [false], resendKey: "t" });

    await adapter.sendTransactional(message);

    expect(resend.sendTransactional).toHaveBeenCalledWith(message);
    expect(consoleSink.sendTransactional).not.toHaveBeenCalled();
  });

  it("falls back to the console when no Resend token is configured", async () => {
    const { adapter, consoleSink, resend } = setup({ consoleSwitch: [false] });

    await adapter.sendTransactional(message);

    expect(consoleSink.sendTransactional).toHaveBeenCalledWith(message);
    expect(resend.sendTransactional).not.toHaveBeenCalled();
  });

  it("reads the switch per message, so an admin flip needs no restart", async () => {
    const { adapter, consoleSink, resend } = setup({
      consoleSwitch: [true, false],
      resendKey: "t",
    });

    await adapter.sendTransactional(message);
    await adapter.sendTransactional(message);

    expect(consoleSink.sendTransactional).toHaveBeenCalledTimes(1);
    expect(resend.sendTransactional).toHaveBeenCalledTimes(1);
  });
});
