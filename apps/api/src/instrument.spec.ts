import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

it("does not transmit SDK logs outside the error-event privacy filter", async () => {
  vi.stubEnv("SENTRY_DSN", "https://00000000000000000000000000000000@o0.ingest.de.sentry.io/1");
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("DOTENV_CONFIG_PATH", ".nonexistent-sentry-test-env");
  await import("./instrument");
  const Sentry = await import("@sentry/nestjs");
  const transport = Sentry.getClient()?.getTransport();
  if (!transport) throw new Error("Sentry transport was not initialized");
  const itemTypes: string[] = [];
  const send = vi.spyOn(transport, "send").mockImplementation(async (envelope) => {
    itemTypes.push(...envelope[1].map(([header]) => header.type));
    return { statusCode: 200 };
  });
  try {
    Sentry.logger.info("synthetic private log", { payload: "must stay local" });
    expect(await Sentry.flush(1000)).toBe(true);
    expect(itemTypes).toEqual([]);
  } finally {
    await Sentry.close(1000);
    send.mockRestore();
  }
}, 15000);
