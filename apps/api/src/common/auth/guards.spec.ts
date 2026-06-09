import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DomainError } from "../errors/domain-error";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLES_KEY } from "./roles.decorator";

const SECRET = "test-secret-test-secret-test-secret";

function ctx(opts: {
  meta?: Record<string, unknown>;
  headers?: Record<string, string>;
  user?: unknown;
}): ExecutionContext {
  const req: Record<string, unknown> = { headers: opts.meta ? {} : (opts.headers ?? {}), user: opts.user };
  if (opts.headers) req.headers = opts.headers;
  return {
    getHandler: () => ({ meta: opts.meta }) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

/** Reflector stub keyed by metadata map on the fake handler. */
function reflectorWith(meta: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
}

describe("JwtAuthGuard", () => {
  const jwt = new JwtService({ secret: SECRET });

  it("allows @Public routes without a token", async () => {
    const guard = new JwtAuthGuard(reflectorWith({ [IS_PUBLIC_KEY]: true }), jwt);
    await expect(guard.canActivate(ctx({ headers: {} }))).resolves.toBe(true);
  });

  it("rejects a missing bearer token", async () => {
    const guard = new JwtAuthGuard(reflectorWith({}), jwt);
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects an invalid token with AUTH_TOKEN_EXPIRED", async () => {
    const guard = new JwtAuthGuard(reflectorWith({}), jwt);
    await expect(
      guard.canActivate(ctx({ headers: { authorization: "Bearer garbage" } })),
    ).rejects.toMatchObject({ code: "AUTH_TOKEN_EXPIRED" });
  });

  it("accepts a valid token and attaches req.user", async () => {
    const token = await jwt.signAsync({ sub: "u1", roles: ["STUDENT"], orgId: null });
    const guard = new JwtAuthGuard(reflectorWith({}), jwt);
    const context = ctx({ headers: { authorization: `Bearer ${token}` } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    expect(req.user?.id).toBe("u1");
  });
});

describe("RolesGuard", () => {
  it("passes when no @Roles metadata is set", () => {
    const guard = new RolesGuard(reflectorWith({}));
    expect(guard.canActivate(ctx({ user: { id: "u1", roles: ["STUDENT"] } }))).toBe(true);
  });

  it("throws Forbidden when the user lacks every required role", () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ["ADMIN"] }));
    expect(() => guard.canActivate(ctx({ user: { id: "u1", roles: ["STUDENT"] } }))).toThrow(
      DomainError,
    );
  });

  it("passes when the user holds one of the required roles", () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: ["ADMIN", "EDITOR"] }));
    expect(guard.canActivate(ctx({ user: { id: "u1", roles: ["EDITOR", "STUDENT"] } }))).toBe(true);
  });
});
