import { type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

export const ARTICLE_PATH = "/blog/kpss-basvuru-sureci";
export const AD_CONSENT_KEY = "mentor.advertising-consent.v1"; // gitleaks:allow -- public storage key
export const ANALYTICS_KEY = "mentor.analytics-consent.v1";
const apiUrl = process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1";

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222", email: "display@test.local", displayName: "Display Test",
  username: "display_test", avatarUrl: null, bio: null, website: null, roles: ["STUDENT"],
  organizationId: null, examType: "KPSS", examVariant: null, examDate: null,
  dailyFocusGoalMinutes: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z",
};

export async function mockBlogAds(page: Page, options: { empty?: boolean; blocked?: boolean; authenticated?: boolean; denied?: boolean } = {}) {
  const state = {
    authenticated: options.authenticated ?? false,
    premium: options.denied ?? false,
    userId: user.id,
    placementCalls: [] as string[],
    scriptRequests: 0,
    refreshCalls: 0,
    refreshHold: null as Promise<void> | null,
  };
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return json(route, null, 204);
    if (path === "/v1/auth/refresh") {
      state.refreshCalls++;
      await state.refreshHold;
      return state.authenticated
        ? json(route, { accessToken: `test-${state.userId}`, expiresIn: 3600, user: { ...user, id: state.userId } })
        : json(route, { code: "AUTH_INVALID_REFRESH", message: "Oturum bulunamadı." }, 401);
    }
    if (path.startsWith("/v1/ads/")) {
      state.placementCalls.push(path);
      const denied = Boolean(options.denied) || (state.premium && !path.includes("/public/"));
      return json(route, {
        id: "knowledge.article.end", format: "DISPLAY", enabled: !denied,
        reason: denied ? "PREMIUM_AD_FREE" : "ELIGIBLE", provider: "GOOGLE_AD_MANAGER",
        adUnitPath: denied ? null : "/6355419/Travel/Europe/France/Paris",
        audienceTreatment: "CHILD", limitedAds: true, sizes: [[320, 100], [728, 90]],
      });
    }
    if (path.endsWith("/view")) return json(route, null, 204);
    if (path === "/v1/users/me") return json(route, { ...user, id: state.userId });
    return json(route, { code: "TEST_UNEXPECTED_REQUEST", message: path }, 501);
  });
  await page.route("https://pagead2.googlesyndication.com/tag/js/gpt.js", async (route) => {
    state.scriptRequests++;
    if (options.blocked) return route.abort();
    return route.fulfill({ contentType: "application/javascript", body: `(${displayGpt.toString()})(${Boolean(options.empty)});` });
  });
  return state;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: {
    "access-control-allow-origin": process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3100",
    "access-control-allow-credentials": "true",
  }, body: body === null ? "" : JSON.stringify(body) });
}

function displayGpt(empty: boolean) {
  const log: string[] = [];
  const listeners = new Set<(event: { slot: object; isEmpty: boolean }) => void>();
  let slot: object;
  let slotId: string;
  const pubads = {
    addEventListener(_name: string, listener: (event: { slot: object; isEmpty: boolean }) => void) { listeners.add(listener); },
    removeEventListener(_name: string, listener: (event: { slot: object; isEmpty: boolean }) => void) { listeners.delete(listener); },
    setPrivacySettings(settings: Record<string, boolean>) { log.push(`privacy:${JSON.stringify(settings)}`); },
  };
  const queued = window.googletag?.cmd ?? [];
  const gpt = {
    cmd: { push(run: () => void) { run(); } },
    pubads: () => pubads, setConfig() {}, enableServices() {},
    defineSlot(_path: string, _sizes: unknown, id: string) { slot = {}; slotId = id; return { addService: () => slot }; },
    display() {
      log.push("display");
      const div = document.getElementById(slotId)!;
      div.textContent = empty ? "" : "Test inventory";
      div.style.height = "100px";
      setTimeout(() => listeners.forEach((run) => run({ slot, isEmpty: empty })), 0);
    },
    destroySlots() {
      log.push("destroy");
      sessionStorage.setItem("test-ad-destroyed", "true");
      const div = document.getElementById(slotId);
      if (div) div.textContent = "";
      return true;
    },
  };
  Object.assign(window, { googletag: gpt, __displayLog: log });
  queued.forEach((run) => run());
}

export async function approachAd(page: Page) {
  await page.getByRole("region", { name: "Bu konu kafanı mı kurcalıyor?" }).scrollIntoViewIfNeeded();
}

export function log(page: Page) {
  return page.evaluate(() => (window as unknown as { __displayLog?: string[] }).__displayLog ?? []);
}
