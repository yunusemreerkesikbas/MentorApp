import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, type INestApplication } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../application/auth.service";
import { GoogleAuthService } from "../application/google-auth.service";
import { AuthController } from "./auth.controller";

describe("web and admin HTTP session isolation", () => {
  let app: INestApplication;
  const session = (email: string, refreshToken: string) => ({
    user: { id: email, email, roles: email === "admin@test.local" ? ["ADMIN"] : ["STUDENT"] },
    tokens: {
      accessToken: `access-${email}`,
      expiresIn: 900,
      refreshToken,
      refreshExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    },
  });

  beforeAll(async () => {
    const auth = {
      login: async () => session("web@test.local", "web-secret"),
      loginAdmin: async () => session("admin@test.local", "admin-secret"),
      refresh: async (raw: string) => {
        if (raw !== "web-secret") throw new UnauthorizedException();
        return session("web@test.local", "web-secret-next");
      },
      refreshAdmin: async (raw: string) => {
        if (raw !== "admin-secret") throw new UnauthorizedException();
        return session("admin@test.local", "admin-secret-next");
      },
      logout: async () => undefined,
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: GoogleAuthService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => "test" } },
        { provide: I18nService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it("keeps two accounts after login, refresh, and admin logout", async () => {
    const webLogin = await request(app.getHttpServer()).post("/v1/auth/login").send({ email: "web@test.local" });
    const adminLogin = await request(app.getHttpServer()).post("/v1/auth/admin/login").send({ email: "admin@test.local" });
    expect(webLogin.status).toBe(200);
    expect(adminLogin.status).toBe(200);
    expect(webLogin.headers["set-cookie"][0]).toContain("mentor_web_refresh=web-secret");
    expect(adminLogin.headers["set-cookie"][0]).toContain("mentor_admin_refresh=admin-secret");
    expect(adminLogin.headers["set-cookie"][0]).toContain("Path=/v1/auth/admin");

    const cookies = "mentor_web_refresh=web-secret; mentor_admin_refresh=admin-secret";
    expect((await request(app.getHttpServer()).post("/v1/auth/refresh")
      .set("Cookie", "mentor_refresh=old-secret")).status).toBe(401);
    expect((await request(app.getHttpServer()).post("/v1/auth/admin/refresh")
      .set("Cookie", "mentor_refresh=old-secret")).status).toBe(401);
    const webRefresh = await request(app.getHttpServer()).post("/v1/auth/refresh").set("Cookie", cookies);
    const adminRefresh = await request(app.getHttpServer()).post("/v1/auth/admin/refresh").set("Cookie", cookies);
    expect(webRefresh.body.user.email).toBe("web@test.local");
    expect(adminRefresh.body.user.email).toBe("admin@test.local");

    const adminLogout = await request(app.getHttpServer()).post("/v1/auth/admin/logout").set("Cookie", cookies);
    expect(adminLogout.status).toBe(204);
    expect(adminLogout.headers["set-cookie"][0]).toContain("mentor_admin_refresh=");
    expect(adminLogout.headers["set-cookie"][0]).not.toContain("mentor_web_refresh=");
    expect((await request(app.getHttpServer()).post("/v1/auth/refresh").set("Cookie", cookies)).body.user.email)
      .toBe("web@test.local");
  });
});
