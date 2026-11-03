import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AuthUser,
  CoachPlanAdaptationDto,
  PlanPreviewAccessDto,
  SavedPlanPreviewDto,
  SubscriptionView,
} from "@mentor/types";
import { browserApiUrl } from "./api.fixture";
import { clockSuffix } from "../src/app/[locale]/(app)/plan/_components/plan-coin-view";

/**
 * "Koçla planla" on the Coin path (docs/plans/2026-11-03-coin-unlock-choice-design.md § Round 2):
 * the choice sheet comes before the wizard, and the wizard's last button names the price.
 */
const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222", email: "coin@test.local", displayName: "Coin Test",
  username: "coin_test", avatarUrl: null, bio: null, website: null, roles: ["STUDENT"], organizationId: null,
  examType: "KPSS", examVariant: null, examDate: "2026-09-06", dailyFocusGoalMinutes: null, careerGroup: null,
  emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z",
};
const preview: CoachPlanAdaptationDto = {
  status: "READY", message: "Planına dokunmadan güvenli bir önizleme hazırladım.", groundingLine: "Bekleyen işlerin var.",
  window: { from: "2026-07-21", to: "2026-07-27" }, planRevision: "a".repeat(64), model: "fake",
  changes: [{ kind: "ADD", title: "Kısa tekrar", subject: null, taskDate: "2026-07-22", durationMinutes: 30 }],
};
const ready: PlanPreviewAccessDto = {
  mode: "COIN", canGenerate: true, cost: 200, dailyLimit: 1, dailyRemaining: 1, coinConfirmed: 320,
  latestRequestId: null, nextAvailableAt: null,
};
const sheetName = "Planını koçla hazırla";

async function mockCoinPlan(page: Page, offers: PlanPreviewAccessDto[], answer?: (call: number) => [number, unknown]) {
  const posts: Record<string, unknown>[] = [];
  let offerCalls = 0;
  let briefCalls = 0;
  const subscription: SubscriptionView = {
    subscription: null, entitlement: { tier: "FREE", isPremium: false, validUntil: null, reason: "NONE" },
    features: {} as SubscriptionView["features"], discount: null,
    trialEligibility: { phoneVerificationRequired: true, eligible: false, reason: "NO_TRIAL" },
    pendingTrialCheckoutUrl: null, pendingCheckoutUrl: null,
  };
  const saved = (requestId: string, cost: number): SavedPlanPreviewDto =>
    ({ requestId, state: "READY", preview, cost, coinSpent: cost });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
  await page.route(`${browserApiUrl}/**`, async (route) => {
    const request = route.request();
    const { pathname: path } = new URL(request.url());
    const method = request.method();
    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") return json(route, { accessToken: "t", expiresIn: 3600, user });
    if (path === "/v1/users/me") return json(route, user);
    if (path.startsWith("/v1/notifications")) return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0, token: "s" });
    if (path === "/v1/subscription") return json(route, subscription);
    if (path === "/v1/plan-events" || path === "/v1/plan-tasks") return json(route, { items: [], total: 0, page: 1, pageSize: 50 });
    if (path === "/v1/plan-tasks/calendar") return json(route, { dates: [] });
    if (path.startsWith("/v1/economy/")) return json(route, { code: "ECONOMY_DISABLED", message: "Kapalı" }, 404);
    if (path.startsWith("/v1/content/exams/by-type/KPSS"))
      return json(route, { id: "11111111-1111-4111-8111-111111111111", slug: "kpss-lisans-2026", name: "KPSS Lisans 2026", family: "KPSS", variant: "LISANS", isCurrent: true });
    if (path === "/v1/content/exams/kpss-lisans-2026/subjects")
      return json(route, [{ slug: "matematik", name: "Matematik", questionCount: 30, sortOrder: 0 }]);
    if (path === "/v1/content/exams/kpss-lisans-2026/topics") return json(route, []);
    if (path === "/v1/coach/plan-previews/access") return json(route, offers[Math.min(offerCalls++, offers.length - 1)]);
    if (path === "/v1/coach/plan-previews/brief") { briefCalls += 1; return json(route, null, 501); }
    if (method === "POST" && path === "/v1/coach/plan-previews") {
      const body = request.postDataJSON() as { clientRequestId: string; expectedCost: number };
      posts.push(body);
      const [status, reply] = answer?.(posts.length) ?? [201, saved(body.clientRequestId, body.expectedCost)];
      return json(route, status === 201 ? saved(body.clientRequestId, body.expectedCost) : reply, status);
    }
    if (method === "GET" && path.startsWith("/v1/coach/plan-previews/")) return json(route, saved(path.split("/").pop()!, 200));
    return json(route, { code: "TEST_UNEXPECTED_REQUEST", message: `${method} ${path}` }, 501);
  });
  return { posts, get briefCalls() { return briefCalls; } };
}

async function walkWizard(page: Page) {
  await expect(page.getByRole("dialog", { name: "Bu hafta hangi günler çalışacaksın?" })).toBeVisible();
  for (const next of ["Günde yaklaşık kaç dakika?", "Ağırlık vermek istediğin dersler", "Bu hafta için notun (isteğe bağlı)"]) {
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByRole("dialog", { name: next })).toBeVisible();
  }
}

test("Coin yolu: seçim sihirbazdan önce gelir, son düğme fiyatı söyler, ikinci pencere çıkmaz", async ({ page }) => {
  const api = await mockCoinPlan(page, [ready]);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();

  const sheet = page.getByRole("dialog", { name: sheetName });
  await expect(sheet.getByRole("heading", { name: "200 Coin ile yeni taslak" })).toBeVisible();
  await expect(sheet.getByText("Bakiyen 320")).toBeVisible();
  await expect(sheet.getByRole("img", { name: "Coin ile 24 saatte 1 taslak hazırlatabilirsin, 1 hakkın duruyor." })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("plan-coin-ready.png") });
  await sheet.getByRole("button", { name: "200 Coin ile hazırla" }).click();
  const confirm = sheet.getByRole("group", { name: "200 Coin ile yeni taslak" });
  await expect(confirm).toContainText("320");
  await expect(confirm).toContainText("120 Coin");
  expect(api.posts).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath("plan-coin-confirm.png") });
  await confirm.getByRole("button", { name: "Onayla ve devam et" }).click();

  await expect(sheet).toHaveCount(0);
  await walkWizard(page);
  expect(api.briefCalls).toBe(1);
  await expect(page.getByRole("button", { name: "Önizlemeyi hazırla" })).toHaveCount(0);
  await page.getByRole("button", { name: "200 Coin ile hazırla" }).click();
  await expect(page.getByRole("dialog", { name: "Plan uyarlama önizlemesi" })).toBeVisible({ timeout: 15_000 });
  expect(api.posts).toEqual([expect.objectContaining({ expectedCost: 200, input: expect.objectContaining({ source: "PLAN" }) })]);
});

test("Coin yetmezse ilerleme ve Coin nasıl birikir görünür, Coin düğmesi çıkmaz", async ({ page }) => {
  await mockCoinPlan(page, [{ ...ready, canGenerate: false, coinConfirmed: 80, reason: "INSUFFICIENT_COIN", message: "Yetersiz" }]);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();

  const sheet = page.getByRole("dialog", { name: sheetName });
  await expect(sheet.getByText("80/200")).toBeVisible();
  await expect(sheet.getByRole("progressbar")).toBeVisible();
  await expect(sheet.getByText("120 Coin daha, taslak senin!", { exact: false })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Coin nasıl birikir" })).toHaveAttribute("href", /\/profil#coin$/);
  await expect(sheet.getByRole("button", { name: "200 Coin ile hazırla" })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("plan-coin-short.png") });
});

test("Günlük hak dolunca kesin saat yazar, kayıtlı taslak açılır", async ({ page }) => {
  const next = new Date(Date.now() + 2 * 3_600_000);
  const time = new Intl.DateTimeFormat("tr", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(next);
  const day = next.toDateString() === new Date().toDateString() ? "bugün" : "yarın";
  await mockCoinPlan(page, [{ ...ready, canGenerate: false, dailyRemaining: 0, reason: "AI_PLAN_COIN_LIMIT_REACHED",
    message: "Dolu", latestRequestId: "55555555-5555-4555-8555-555555555555", nextAvailableAt: next.toISOString() }]);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();

  const sheet = page.getByRole("dialog", { name: sheetName });
  await expect(sheet.getByRole("heading", { name: "Bugünkü taslağını hazırladın, süper!" })).toBeVisible();
  await expect(sheet.getByText(`Sıradaki taslak hakkın ${day} ${time}'${clockSuffix(time)} geliyor.`)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("plan-coin-limit.png") });
  await sheet.getByRole("button", { name: "Kayıtlı taslağımı aç" }).click();
  await expect(page.getByRole("dialog", { name: "Plan uyarlama önizlemesi" })).toBeVisible();
});

test("Fiyat değişirse seçim yeni fiyatla geri gelir ve Coin harcanmadan yeniden gönderilir", async ({ page }) => {
  const api = await mockCoinPlan(page, [ready, { ...ready, cost: 150 }], (call) => call === 1
    ? [409, { code: "AI_PLAN_PRICE_CHANGED", message: "Plan taslağının Coin bedeli değişti. Güncel bedelle yeniden onay verebilirsin." }]
    : [201, null]);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Koçla planla" }).click();
  const sheet = page.getByRole("dialog", { name: sheetName });
  await sheet.getByRole("button", { name: "200 Coin ile hazırla" }).click();
  await sheet.getByRole("button", { name: "Onayla ve devam et" }).click();
  await walkWizard(page);
  await page.getByRole("button", { name: "200 Coin ile hazırla" }).click();

  await expect(sheet.getByRole("alert")).toHaveText("Plan taslağının Coin bedeli değişti. Güncel bedelle yeniden onay verebilirsin.");
  const confirm = sheet.getByRole("group", { name: "150 Coin ile yeni taslak" });
  await expect(confirm).toContainText("170 Coin");
  await page.screenshot({ path: test.info().outputPath("plan-coin-price-changed.png") });
  await confirm.getByRole("button", { name: "Onayla ve devam et" }).click();
  await expect(page.getByRole("dialog", { name: "Plan uyarlama önizlemesi" })).toBeVisible({ timeout: 15_000 });
  expect(api.posts.map((body) => body.expectedCost)).toEqual([200, 150]);
});

const corsHeaders = {
  "access-control-allow-origin": new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").origin,
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", headers: corsHeaders, body: body == null ? "" : JSON.stringify(body) });
}
