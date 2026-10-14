import { describe, expect, it } from "vitest";
import { AuthOriginGuard } from "./auth-origin.guard";

const guard = new AuthOriginGuard({ get: (key: string) => ({
  APP_URL: "https://app.mentor.test", ADMIN_APP_URL: "https://admin.mentor.test",
})[key] } as never);

function context(path: string, origin?: string, method = "POST") {
  return { switchToHttp: () => ({ getRequest: () => ({
    method, originalUrl: path, headers: { origin },
  }) }) } as never;
}

describe("auth Origin boundary", () => {
  it.each([undefined, "null", "https://evil.test", "https://app.mentor.test.evil.test", "https://app.mentor.test/"])(
    "rejects invalid web Origin %s", (origin) => {
      expect(() => guard.canActivate(context("/v1/auth/login", origin))).toThrow();
    },
  );
  it.each(["login", "signup", "refresh", "logout", "forgot-password", "reset-password", "verify-email"])(
    "checks web auth POST %s", (path) => {
      expect(guard.canActivate(context(`/v1/auth/${path}`, "https://app.mentor.test"))).toBe(true);
      expect(() => guard.canActivate(context(`/v1/auth/${path}`, "https://admin.mentor.test"))).toThrow();
    },
  );
  it.each(["login", "refresh", "logout"])("checks admin Origin for %s", (path) => {
    expect(guard.canActivate(context(`/v1/auth/admin/${path}`, "https://admin.mentor.test"))).toBe(true);
    expect(() => guard.canActivate(context(`/v1/auth/admin/${path}`, "https://app.mentor.test"))).toThrow();
  });
  it("leaves OAuth callbacks and non-auth paths to their existing guards", () => {
    expect(guard.canActivate(context("/v1/auth/google/callback?code=dummy", undefined, "GET"))).toBe(true);
    expect(guard.canActivate(context("/v1/internal/cron/process-jobs"))).toBe(true);
  });
});
