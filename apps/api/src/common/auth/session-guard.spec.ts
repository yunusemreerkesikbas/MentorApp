import { JwtService } from "@nestjs/jwt";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { UnauthorizedError } from "../errors/domain-error";

const jwt = new JwtService({ secret: "session-guard-test-secret-32-characters" });
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function setup(validateSession = vi.fn()) {
  const req = { headers: {} as Record<string, string>, user: undefined as unknown };
  const context = {
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  const guard = new JwtAuthGuard(
    { getAllAndOverride: () => false } as never,
    jwt,
    { validateSession } as never,
  );
  return { req, context, guard, validateSession };
}

describe("authoritative session guard", () => {
  it("uses current roles and organization rather than signed stale claims", async () => {
    const principal = { id: userId, sessionId, roles: ["STUDENT"], orgId: null };
    const s = setup(vi.fn().mockResolvedValue(principal));
    s.req.headers.authorization = `Bearer ${await jwt.signAsync({ sub: userId, sid: sessionId, roles: ["ADMIN"], orgId: "old" })}`;
    await expect(s.guard.canActivate(s.context)).resolves.toBe(true);
    expect(s.req.user).toEqual(principal);
    expect(s.validateSession).toHaveBeenCalledWith(sessionId, userId);
  });

  it("denies legacy tokens without a persistent session", async () => {
    const s = setup();
    s.req.headers.authorization = `Bearer ${await jwt.signAsync({ sub: userId, roles: ["ADMIN"] })}`;
    await expect(s.guard.canActivate(s.context)).rejects.toBeDefined();
    expect(s.validateSession).not.toHaveBeenCalled();
  });

  it("denies the next request after suspension or session revocation", async () => {
    const s = setup(vi.fn().mockRejectedValue(new UnauthorizedError()));
    s.req.headers.authorization = `Bearer ${await jwt.signAsync({ sub: userId, sid: sessionId })}`;
    await expect(s.guard.canActivate(s.context)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("does not disguise a database outage as token expiry", async () => {
    const outage = new Error("database unavailable");
    const s = setup(vi.fn().mockRejectedValue(outage));
    s.req.headers.authorization = `Bearer ${await jwt.signAsync({ sub: userId, sid: sessionId })}`;
    await expect(s.guard.canActivate(s.context)).rejects.toBe(outage);
  });
});
