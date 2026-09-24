import { ConsoleLogger, Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerEmailAdapter } from "./logger-email.adapter";

const envFake = (env: Record<string, string | undefined>) => ({ get: (key: string) => env[key] });

const message = {
  to: "student@example.com",
  template: "identity.verify-email",
  variables: {
    displayName: "Ada",
    link: "http://localhost:3000/eposta-dogrula?token=raw-token",
  },
};

describe("LoggerEmailAdapter", () => {
  let written: string[];

  beforeEach(() => {
    // The running app installs pino, whose logMethod hook drops every freeform message
    // (observability/logger.config.ts). Silence the Nest logger the same way, so only output that
    // really survives in the app counts here.
    Logger.overrideLogger(false);
    written = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Logger.overrideLogger(new ConsoleLogger());
  });

  it("prints recipient, template and link on one stdout line in dev tooling", async () => {
    const adapter = new LoggerEmailAdapter(envFake({ NODE_ENV: "development" }) as never);

    await adapter.sendTransactional(message);

    const lines = written.join("").split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("student@example.com");
    expect(lines[0]).toContain("identity.verify-email");
    expect(lines[0]).toContain("http://localhost:3000/eposta-dogrula?token=raw-token");
  });

  it("prints on staging, which runs NODE_ENV=production", async () => {
    const adapter = new LoggerEmailAdapter(
      envFake({ NODE_ENV: "production", APP_ENV: "staging" }) as never,
    );

    await adapter.sendTransactional(message);

    expect(written.join("")).toContain("eposta-dogrula?token=raw-token");
  });

  it("refuses in production instead of writing a reset link into the logs", async () => {
    const adapter = new LoggerEmailAdapter(envFake({ NODE_ENV: "production" }) as never);

    await expect(adapter.sendTransactional(message)).rejects.toThrow();
    expect(written).toEqual([]);
  });
});
