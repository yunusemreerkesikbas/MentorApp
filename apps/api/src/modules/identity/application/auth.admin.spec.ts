import * as argon2 from "argon2";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

const tokens = {
  accessToken: "access",
  expiresIn: 900,
  refreshToken: "refresh",
  refreshExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
};

let passwordHash: string;
beforeAll(async () => { passwordHash = await argon2.hash("Sifre1234"); });

function setup(roles: string[]) {
  const user = {
    id: "user-1", email: "person@example.com", passwordHash,
    status: "ACTIVE", roles, organizationId: null, createdAt: new Date(),
  };
  const users = {
    findByEmailService: vi.fn(async () => user),
    findByIdService: vi.fn(async () => user),
  };
  const tokenService = {
    issue: vi.fn(async () => tokens),
    rotate: vi.fn(async () => ({ userId: user.id, tokens })),
    revokeByRawToken: vi.fn(async () => undefined),
  };
  const rates = { consumeAccount: vi.fn(async () => ({ allowed: true, retryAfter: 0 })) };
  const config = { get: vi.fn(() => "test") };
  const service = new AuthService(
    users as never, {} as never, tokenService as never,
    { assertValid: vi.fn(async () => undefined) } as never,
    config as never, {} as never, {} as never, {} as never, {} as never, rates as never,
  );
  return { service, tokenService, rates, config };
}

describe("admin auth role gate", () => {
  it("rejects a student before issuing an admin login session", async () => {
    const { service, tokenService } = setup(["STUDENT"]);
    await expect(service.loginAdmin({ email: "person@example.com", password: "Sifre1234" }))
      .rejects.toMatchObject({ httpStatus: 403 });
    expect(tokenService.issue).not.toHaveBeenCalled();
  });

  it("allows a scoped panel role to log in", async () => {
    const { service, tokenService } = setup(["STUDENT", "EDITOR"]);
    await expect(service.loginAdmin({ email: "person@example.com", password: "Sifre1234" }))
      .resolves.toMatchObject({ tokens });
    expect(tokenService.issue).toHaveBeenCalledOnce();
  });

  it("revokes a rotated admin session when its panel role was removed", async () => {
    const { service, tokenService } = setup(["STUDENT"]);
    await expect(service.refreshAdmin("old-refresh")).rejects.toMatchObject({ httpStatus: 403 });
    expect(tokenService.revokeByRawToken).toHaveBeenCalledWith("refresh");
  });

  it("rotates an admin session while its panel role is still present", async () => {
    const { service, tokenService } = setup(["STUDENT", "SUPPORT"]);
    await expect(service.refreshAdmin("old-refresh")).resolves.toMatchObject({ tokens });
    expect(tokenService.revokeByRawToken).not.toHaveBeenCalled();
  });

  it("revokes the rotated session when the signed Access email differs", async () => {
    const { service, tokenService } = setup(["SUPPORT"]);
    await expect(service.refreshAdmin("old-refresh", "other@example.com"))
      .rejects.toMatchObject({ httpStatus: 403 });
    expect(tokenService.rotate).toHaveBeenCalledWith("old-refresh");
    expect(tokenService.revokeByRawToken).toHaveBeenCalledWith("refresh");
  });

  it("requires Access identity before rotating a production admin session", async () => {
    const { service, tokenService, config } = setup(["SUPPORT"]);
    config.get.mockReturnValue("production");
    await expect(service.refreshAdmin("old-refresh")).rejects.toMatchObject({ httpStatus: 403 });
    expect(tokenService.rotate).not.toHaveBeenCalled();
  });

  it("spends the same account quota for successful web and admin logins", async () => {
    const { service, rates } = setup(["SUPPORT"]);
    const input = { email: "person@example.com", password: "Sifre1234" };
    await service.login(input);
    await service.loginAdmin(input);
    expect(rates.consumeAccount.mock.calls).toEqual([
      ["login", input.email], ["login", input.email],
    ]);
  });
});
