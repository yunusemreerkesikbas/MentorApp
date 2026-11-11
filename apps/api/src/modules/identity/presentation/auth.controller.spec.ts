import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { AuthController } from "./auth.controller";

const result = {
  user: { id: "user-1", roles: ["ADMIN"] },
  tokens: {
    accessToken: "access",
    expiresIn: 900,
    refreshToken: "secret",
    refreshExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
  },
};

function setup(authResult = result, nodeEnv = "test") {
  const auth = {
    signup: vi.fn(async () => authResult),
    login: vi.fn(async () => authResult),
    loginAdmin: vi.fn(async () => authResult),
    refresh: vi.fn(async () => authResult),
    refreshAdmin: vi.fn(async () => result),
    logout: vi.fn(async () => undefined),
  };
  const response = { cookie: vi.fn(), clearCookie: vi.fn() };
  const controller = new AuthController(
    auth as never,
    {} as never,
    { get: vi.fn(() => nodeEnv) } as never,
    {} as never,
    {} as never,
  );
  return { auth, controller, response };
}

describe("separate web and admin refresh cookies", () => {
  it("sets the private-media proof only for web sessions and keeps it out of JSON", async () => {
    const proof = "test-media-proof";
    const authResult = { ...result, tokens: { ...result.tokens, mediaSessionProof: proof } };
    const { controller, response } = setup(authResult, "production");
    const session = await controller.login({} as never, response as never);
    expect(JSON.stringify(session)).not.toContain(proof);
    expect(session.refreshToken).toBeUndefined();
    expect(response.cookie).toHaveBeenCalledWith("mentor_media_session", proof,
      expect.objectContaining({ path: "/v1/storage/media/private", httpOnly: true, secure: true, sameSite: "lax" }));
    response.cookie.mockClear();

    await controller.adminLogin({} as never, response as never, { cloudflareAccessEmail: "admin@test.local" } as never);
    expect(response.cookie).not.toHaveBeenCalledWith("mentor_media_session", expect.anything(), expect.anything());

    await controller.logout({} as never, response as never);
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_media_session", { path: "/v1/storage/media/private" });
  });

  it("sets a web cookie on regular login and an admin-only cookie on admin login", async () => {
    const { controller, response } = setup();

    await controller.login({} as never, response as never);
    expect(response.cookie).toHaveBeenCalledWith(
      "mentor_web_refresh", "secret", expect.objectContaining({ path: "/v1/auth", httpOnly: true }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_refresh", { path: "/v1/auth" });
    response.cookie.mockClear();

    await controller.adminLogin({} as never, response as never, { cloudflareAccessEmail: "admin@test.local" } as never);
    expect(response.cookie).toHaveBeenCalledWith(
      "mentor_admin_refresh", "secret", expect.objectContaining({ path: "/v1/auth/admin", httpOnly: true }),
    );
    expect(response.cookie).not.toHaveBeenCalledWith("mentor_web_refresh", expect.anything(), expect.anything());
  });

  it("refreshes and logs out only the selected surface", async () => {
    const { auth, controller, response } = setup();
    const cookies = { mentor_web_refresh: "web", mentor_admin_refresh: "admin", mentor_refresh: "old" };

    await controller.refresh({ cookies } as never, response as never);
    await controller.adminRefresh({ cookies } as never, response as never);
    expect(auth.refresh).toHaveBeenCalledWith("web");
    expect(auth.refreshAdmin).toHaveBeenCalledWith("admin", undefined);

    await controller.adminLogout({ cookies } as never, response as never);
    expect(auth.logout).toHaveBeenCalledWith("admin");
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_admin_refresh", { path: "/v1/auth/admin" });
    expect(response.clearCookie).not.toHaveBeenCalledWith("mentor_web_refresh", expect.anything());
  });

  it("supports mobile SecureStore refresh token rotation only when X-Client-Platform is mobile", async () => {
    const { auth, controller, response } = setup();
    const mobileReq = {
      headers: {
        "x-client-platform": "mobile",
        "x-refresh-token": "mobile-refresh-1",
      },
      cookies: {},
    };

    const loginSession = await controller.login({} as never, response as never, mobileReq as never);
    expect(loginSession.refreshToken).toBe("secret");

    const refreshedSession = await controller.refresh(mobileReq as never, response as never);
    expect(auth.refresh).toHaveBeenCalledWith("mobile-refresh-1");
    expect(refreshedSession.refreshToken).toBe("secret");

    await controller.logout(mobileReq as never, response as never);
    expect(auth.logout).toHaveBeenCalledWith("mobile-refresh-1");

    // Web requests without x-client-platform: mobile ignore x-refresh-token header
    auth.refresh.mockClear();
    await controller.refresh(
      { headers: { "x-refresh-token": "spoofed" }, cookies: {} } as never,
      response as never,
    );
    expect(auth.refresh).toHaveBeenCalledWith("");
  });

  it("ignores the legacy shared cookie after migration", async () => {
    const { auth, controller, response } = setup();
    await controller.refresh({ cookies: { mentor_refresh: "old" } } as never, response as never);
    await controller.adminRefresh({ cookies: { mentor_refresh: "old" } } as never, response as never);
    expect(auth.refresh).toHaveBeenCalledWith("");
    expect(auth.refreshAdmin).toHaveBeenCalledWith("", undefined);
  });

  it("web logout leaves the admin cookie untouched", async () => {
    const { auth, controller, response } = setup();
    await controller.logout({ cookies: { mentor_web_refresh: "web", mentor_admin_refresh: "admin" } } as never, response as never);
    expect(auth.logout).toHaveBeenCalledWith("web");
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_web_refresh", { path: "/v1/auth" });
    expect(response.clearCookie).not.toHaveBeenCalledWith("mentor_admin_refresh", expect.anything());
  });
});

describe("Google callback error redirects", () => {
  async function failWith(mode: "signup" | "login", locale: "tr" | "en") {
    const googleAuth = {
      verifyState: vi.fn(() => ({ mode, locale, returnTo: "/dashboard" })),
      callback: vi.fn(async () => {
        throw new DomainError(ErrorCode.AUTH_PILOT_INVITATION_REQUIRED, 403);
      }),
    };
    const controller = new AuthController(
      {} as never,
      googleAuth as never,
      { get: vi.fn(() => "https://app.test/") } as never,
      { translate: vi.fn(() => "Davet gerekli") } as never,
      {} as never,
    );
    const res = { clearCookie: vi.fn(), redirect: vi.fn() };
    await controller.googleCallback(
      { state: "s", code: "c" } as never,
      { cookies: { mentor_google_oauth: "x" } } as never,
      res as never,
    );
    return new URL(res.redirect.mock.calls[0]![0] as string);
  }

  it("sends a refused signup back to the signup page with davet=1", async () => {
    const tr = await failWith("signup", "tr");
    expect(tr.pathname).toBe("/kayit");
    expect(tr.searchParams.get("davet")).toBe("1");
    expect(tr.searchParams.get("googleErrorCode")).toBe(ErrorCode.AUTH_PILOT_INVITATION_REQUIRED);
    expect(tr.searchParams.get("googleError")).toBe("Davet gerekli");

    const en = await failWith("signup", "en");
    expect(en.pathname).toBe("/en/signup");
    expect(en.searchParams.get("davet")).toBe("1");
  });

  it("keeps login-mode errors on the login page", async () => {
    const tr = await failWith("login", "tr");
    expect(tr.pathname).toBe("/giris");
    expect(tr.searchParams.has("davet")).toBe(false);
    expect((await failWith("login", "en")).pathname).toBe("/en/login");
  });
});
