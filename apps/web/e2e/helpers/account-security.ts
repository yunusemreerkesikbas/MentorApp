import { expect, type Page } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

export const user: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333", email: "security@test.local",
  displayName: "Security Test", username: "security_test", avatarUrl: null, bio: null, website: null,
  roles: ["STUDENT"], organizationId: null, examType: "KPSS", examVariant: null,
  examDate: null, dailyFocusGoalMinutes: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z",
};
type Widget = { callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void };
export type CaptchaState = { widget?: Widget; renders: number; removals: number };
const pageErrors = new WeakMap<Page, string[]>();

export async function expectSecurityPageHealthy(page: Page) {
  expect(pageErrors.get(page) ?? []).toEqual([]);
}
type ResponseError = { status: number; code: string; message: string };
export type SecurityOptions = {
  loadCaptchaScript?: boolean;
  authenticated?: boolean;
  reauth?: boolean;
  failure?: boolean;
  sessionState?: { authenticated: boolean };
  authError?: ResponseError;
  patchError?: ResponseError;
  logoutFailure?: boolean;
  authPending?: Promise<void>;
};

export async function mockSecurity(page: Page, options: SecurityOptions = {}) {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  const sessionState = options.sessionState ?? { authenticated: options.authenticated ?? false };
  const calls = { login: [] as Record<string, unknown>[], forgot: [] as Record<string, unknown>[], patchBodies: [] as Record<string, unknown>[], patches: 0, deletes: 0, logouts: 0 };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((loadCaptchaScript) => {
    // Browser init scripts also run in blocked/opaque iframe documents; mock only the app.
    if (window !== window.top) return;
    localStorage.setItem("mentor.analytics-consent.v1", "rejected");
    const state: CaptchaState = { renders: 0, removals: 0 };
    (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha = state;
    if (!loadCaptchaScript) Object.defineProperty(window, "turnstile", { value: {
      render: (container: HTMLElement, widget: Widget & { action: string }) => {
        state.widget = widget;
        container.dataset.securityCaptcha = widget.action;
        return String(++state.renders);
      },
      remove: () => { state.removals++; },
    } });
  }, options.loadCaptchaScript ?? false);
  // Keep provider loading deterministic; no external CAPTCHA script is executed.
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    const session = () => json({ accessToken: "test-token", expiresIn: 3600, user });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/v1/auth/refresh") return sessionState.authenticated ? session() : json({ code: "AUTH_SESSION_INVALID", message: "Sign in" }, 401);
    if (path === "/v1/auth/logout") {
      calls.logouts++;
      if (options.logoutFailure) return route.abort("failed");
      sessionState.authenticated = false;
      return route.fulfill({ status: 204, headers });
    }
    if (path === "/v1/auth/login") {
      calls.login.push(request.postDataJSON());
      await options.authPending;
      if (options.authError) return json(options.authError, options.authError.status);
      if (options.failure) return json({ code: "AUTH_INVALID_CREDENTIALS", message: "Try again" }, 401);
      sessionState.authenticated = true;
      return session();
    }
    if (path === "/v1/auth/forgot-password") {
      calls.forgot.push(request.postDataJSON());
      await options.authPending;
      if (options.authError) return json(options.authError, options.authError.status);
      return options.failure ? json({ code: "AUTH_TURNSTILE_UNAVAILABLE", message: "Try again" }, 503) : json({ ok: true });
    }
    if (path === "/v1/auth/google/status") return json({ enabled: true });
    if (path === "/v1/users/me" && method === "PATCH") {
      calls.patches++;
      const patch = request.postDataJSON() as Record<string, unknown>;
      calls.patchBodies.push(patch);
      if (options.reauth) return json({ code: "AUTH_REAUTHENTICATION_REQUIRED", message: "Sign in again" }, 403);
      if (options.patchError) return json(options.patchError, options.patchError.status);
      if (patch.email) sessionState.authenticated = false;
      return json({ ...user, ...patch, emailVerified: patch.email ? false : user.emailVerified });
    }
    if (path === "/v1/account" && method === "DELETE") {
      calls.deletes++;
      return json({ code: "AUTH_REAUTHENTICATION_REQUIRED", message: "Sign in again" }, 403);
    }
    if (path === "/v1/users/me") return json(user);
    if (path === "/v1/users/me/phone") return json({ verified: false, maskedPhoneNumber: null, available: false, reauthenticationRequired: false });
    if (path === "/v1/users/me/auth-accounts/google") return json({ enabled: false, linked: false, providerEmail: null, canLink: false });
    if (path === "/v1/subscription") return json({ subscription: null, entitlement: { tier: "FREE", isPremium: false } });
    if (path === "/v1/notifications/preferences") return json({ emailEnabled: true, pushEnabled: false, campaignsEnabled: true });
    if (path === "/v1/notifications/stream-token") return json({ token: "stream" });
    if (path === "/v1/notifications/stream") return route.fulfill({ status: 200, headers, contentType: "text/event-stream", body: "" });
    if (path === "/v1/community/achievements/unseen") return json({ celebrations: [] });
    if (path.startsWith("/v1/economy/")) return json({ code: "ECONOMY_DISABLED", message: "Disabled" }, 404);
    return json({ items: [], total: 0, unreadCount: 0, enabled: false });
  });
  return calls;
}

export async function completeCaptcha(page: Page, token = "security-token") {
  const widget = page.locator("[data-security-captcha]");
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) await expect(widget).toBeAttached();
  if (await widget.count()) {
    await page.evaluate((value) => (window as unknown as { securityCaptcha: CaptchaState }).securityCaptcha.widget?.callback(value), token);
  }
}
