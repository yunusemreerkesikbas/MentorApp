import { describe, expect, it, vi } from "vitest";
import { CloudflareAccessGuard } from "./cloudflare-access.guard";

function context(path: string, assertion?: string) {
  const request = {
    originalUrl: path,
    path,
    headers: assertion ? { "cf-access-jwt-assertion": assertion } : {},
    user: { id: "user-id", sessionId: "session-id", roles: ["ADMIN"], orgId: null },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe("CloudflareAccessGuard", () => {
  const setup = (nodeEnv = "production", accessEmail = "admin@mentor.test", appEmail = "admin@mentor.test") => {
    const verify = vi.fn(async () => ({ email: accessEmail }));
    const guard = new CloudflareAccessGuard(
      { get: vi.fn(() => nodeEnv) } as never,
      { verify } as never,
      { getAdminAccessIdentity: vi.fn(async () => ({ email: appEmail })) } as never,
    );
    return { guard, verify };
  };

  it("does not apply the Access gate to non-admin API routes", async () => {
    const { guard, verify } = setup();
    await expect(guard.canActivate(context("/v1/users/me"))).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("requires an Access assertion on production admin routes", async () => {
    const { guard } = setup();
    await expect(guard.canActivate(context("/v1/admin/users"))).rejects.toMatchObject({
      httpStatus: 401,
    });
  });

  it("binds the Cloudflare identity to the authenticated application account", async () => {
    const { guard } = setup("production", "other@mentor.test", "admin@mentor.test");
    await expect(
      guard.canActivate(context("/v1/admin/users", "signed-assertion")),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("allows a matching, verified Access and application identity", async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(context("/v1/admin/users?limit=10", "signed-assertion")),
    ).resolves.toBe(true);
  });

  it("keeps local development usable without Cloudflare", async () => {
    const { guard, verify } = setup("development");
    await expect(guard.canActivate(context("/v1/admin/users"))).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });
});
