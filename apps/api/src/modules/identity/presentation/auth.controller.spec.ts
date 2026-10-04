import { describe, expect, it, vi } from "vitest";
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

function setup() {
  const auth = {
    login: vi.fn(async () => result),
    loginAdmin: vi.fn(async () => result),
    refresh: vi.fn(async () => result),
    refreshAdmin: vi.fn(async () => result),
    logout: vi.fn(async () => undefined),
  };
  const response = { cookie: vi.fn(), clearCookie: vi.fn() };
  const controller = new AuthController(
    auth as never,
    {} as never,
    { get: vi.fn(() => "test") } as never,
    {} as never,
  );
  return { auth, controller, response };
}

describe("separate web and admin refresh cookies", () => {
  it("sets a web cookie on regular login and an admin-only cookie on admin login", async () => {
    const { controller, response } = setup();

    await controller.login({} as never, response as never);
    expect(response.cookie).toHaveBeenCalledWith(
      "mentor_web_refresh", "secret", expect.objectContaining({ path: "/v1/auth", httpOnly: true }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_refresh", { path: "/v1/auth" });
    response.cookie.mockClear();

    await controller.adminLogin({} as never, response as never);
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
    expect(auth.refreshAdmin).toHaveBeenCalledWith("admin");

    await controller.adminLogout({ cookies } as never, response as never);
    expect(auth.logout).toHaveBeenCalledWith("admin");
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_admin_refresh", { path: "/v1/auth/admin" });
    expect(response.clearCookie).not.toHaveBeenCalledWith("mentor_web_refresh", expect.anything());
  });

  it("ignores the legacy shared cookie after migration", async () => {
    const { auth, controller, response } = setup();
    await controller.refresh({ cookies: { mentor_refresh: "old" } } as never, response as never);
    await controller.adminRefresh({ cookies: { mentor_refresh: "old" } } as never, response as never);
    expect(auth.refresh).toHaveBeenCalledWith("");
    expect(auth.refreshAdmin).toHaveBeenCalledWith("");
  });

  it("web logout leaves the admin cookie untouched", async () => {
    const { auth, controller, response } = setup();
    await controller.logout({ cookies: { mentor_web_refresh: "web", mentor_admin_refresh: "admin" } } as never, response as never);
    expect(auth.logout).toHaveBeenCalledWith("web");
    expect(response.clearCookie).toHaveBeenCalledWith("mentor_web_refresh", { path: "/v1/auth" });
    expect(response.clearCookie).not.toHaveBeenCalledWith("mentor_admin_refresh", expect.anything());
  });
});
