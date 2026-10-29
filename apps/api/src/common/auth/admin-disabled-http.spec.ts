import { Controller, Get, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AllExceptionsFilter } from "../filters/all-exceptions.filter";
import { CloudflareAccessGuard } from "./cloudflare-access.guard";

const handler = vi.fn(() => ({ ok: true }));
const verify = vi.fn();
const identity = vi.fn();

@Controller()
class BoundaryFixture {
  @Get(["admin", "admin/config", "admin/users", "admin/content/articles"])
  readAdmin() { return handler(); }

  @Post(["admin/ai/reembed", "auth/admin/login", "auth/admin/refresh", "auth/admin/logout"])
  mutateAdmin() { return handler(); }

  @Get("users/me")
  readUser() { return { ok: true }; }
}

describe("closed admin HTTP boundary", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [BoundaryFixture] }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { id: "old-admin", sessionId: "old-session", roles: ["SUPER_ADMIN"] };
      next();
    });
    app.useGlobalGuards(new CloudflareAccessGuard(
      { get: (key: string) => key === "ADMIN_ACCESS_MODE" ? "disabled" : "production" } as never,
      { verify } as never, { getAdminAccessIdentity: identity } as never,
    ));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(async () => { await app?.close(); });

  it.each(["/v1/admin", "/v1/admin/config", "/v1/admin/users?limit=10", "/v1/admin/content/articles", "/V1/ADMIN/CONFIG/"])(
    "rejects admin reads at %s before the handler", async (path) => {
      const response = await request(app.getHttpServer()).get(path).set("cf-access-jwt-assertion", "forged");
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: "FORBIDDEN" });
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
      expect(identity).not.toHaveBeenCalled();
    },
  );

  it.each(["/v1/admin/ai/reembed", "/v1/auth/admin/login", "/v1/auth/admin/refresh", "/v1/auth/admin/logout"])(
    "rejects admin mutations at %s without issuing cookies", async (path) => {
      const response = await request(app.getHttpServer()).post(path).send({});
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: "FORBIDDEN" });
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it("keeps the ordinary user route reachable", async () => {
    const response = await request(app.getHttpServer()).get("/v1/users/me");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
