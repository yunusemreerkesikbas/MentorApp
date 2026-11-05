import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Invite-only signup: while `signupWaitlist` is on, every "start" opens the waitlist card instead of
 * the signup form. Runs with `playwright.waitlist.config.ts`, which owns the availability API the
 * server reads (`QA_WAITLIST_API`); browser calls are stubbed here.
 */
const api = process.env.QA_WAITLIST_API ?? "http://localhost:3381";
const TITLE = "Yerini şimdiden ayıralım!";
const SUCCESS = "Harika, listedesin!";

async function setWaitlist(request: APIRequestContext, signupWaitlist: boolean, studentSignup = true) {
  const response = await request.post(`${api}/__qa/availability`, { data: { signupWaitlist, studentSignup } });
  expect(response.ok()).toBe(true);
}

/** Records what the card sends; the API answers every valid request with the same 204. */
async function stubWaitlist(page: Page) {
  const joins: Record<string, unknown>[] = [];
  const logins: unknown[] = [];
  await page.route("**/v1/auth/{waitlist,login}", async (route) => {
    const request = route.request();
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3380",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.url().endsWith("/login")) {
      logins.push(request.postDataJSON());
      return route.fulfill({ status: 401, headers, contentType: "application/json", body: "{}" });
    }
    joins.push(request.postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 204, headers });
  });
  return { joins, logins };
}

const card = (page: Page, name = TITLE) => page.getByRole("dialog", { name });

test.beforeEach(async ({ page, request }) => {
  await setWaitlist(request, true);
  await page.addInitScript(() => window.localStorage.removeItem("mentor_welcome_seen"));
});

test("landing start opens the waitlist modal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Ücretsiz başla" }).first().click();
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByText("Çok yakında")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("waitlist join shows success", async ({ page }) => {
  const { joins } = await stubWaitlist(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Ana menü" }).getByRole("button", { name: "Ücretsiz başla" }).click();
  await card(page).getByRole("textbox", { name: "E-posta adresin" }).fill("aday@test.local");
  await card(page).getByRole("button", { name: "Beni listeye ekle" }).click();

  await expect(card(page, SUCCESS)).toBeVisible();
  await expect(card(page, SUCCESS).getByText("aday@test.local")).toBeVisible();
  expect(joins).toEqual([{ email: "aday@test.local", role: "student", locale: "tr" }]);
  // The room's lamp comes on with the success art.
  await expect(card(page, SUCCESS).locator(".lw-art img")).toHaveAttribute("src", /w2\.webp/);
  await expect(card(page, SUCCESS).locator(".lw-art > div")).toHaveCount(1);
});

test("/kayit shows the modal, /kayit?davet=1 shows the form", async ({ page }) => {
  await page.goto("/kayit");
  await expect(card(page)).toBeVisible();
  await expect(page.locator('input[name="displayName"]')).toHaveCount(0);
  // Leaving the card leaves the page: there is no form behind it.
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/kayit?davet=1");
  await expect(page.getByRole("heading", { name: "Hesap oluştur" })).toBeVisible();
  await expect(page.locator('input[name="displayName"]')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("closed mode: the invite link shows the modal, not a form that can only fail", async ({ page, request }) => {
  // `signup.enabled=false`: the API reports studentSignup false and the waitlist on, and admits nobody.
  await setWaitlist(request, true, false);
  await page.goto("/kayit?davet=1");
  await expect(card(page)).toBeVisible();
  await expect(page.locator('input[name="displayName"]')).toHaveCount(0);
  await page.goto("/kayit?davet=1&rol=koc");
  await expect(card(page)).toBeVisible();
  await expect(page.locator('input[name="displayName"]')).toHaveCount(0);
});

test("an invited coach gets the form, not the closed notice", async ({ page }) => {
  // Coach signup is closed on the fixture; the invite let this coach in.
  await page.goto("/kayit?davet=1&rol=koc");
  await expect(page.getByRole("heading", { name: "Koç olarak katıl" })).toBeVisible();
  await expect(page.locator('input[name="displayName"]')).toBeVisible();
});

test("the card's Giriş yap on /kayit lands on the login page", async ({ page }) => {
  await page.goto("/kayit");
  await card(page).getByRole("link", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test("a Google signup refusal comes back to the invite form with its reason", async ({ page }) => {
  const query = new URLSearchParams({ googleError: "Bu Google hesabı için davet bulunamadı.", googleErrorCode: "AUTH_PILOT_INVITATION_REQUIRED" });
  await page.goto(`/kayit?davet=1&${query}`);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Bu Google hesabı için davet bulunamadı.");
  await expect(card(page)).toHaveCount(0);
});

test("login Kayıt ol opens the modal", async ({ page }) => {
  const { joins, logins } = await stubWaitlist(page);
  await page.goto("/giris");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(card(page)).toBeVisible();
  // The card's own form, opened from inside the login form, submits only itself.
  await card(page).getByRole("textbox", { name: "E-posta adresin" }).fill("aday@test.local");
  await card(page).getByRole("button", { name: "Beni listeye ekle" }).click();
  await expect(card(page, SUCCESS)).toBeVisible();
  expect(joins).toHaveLength(1);
  expect(logins).toEqual([]);
});

test("login googleErrorCode=AUTH_GOOGLE_ACCOUNT_NOT_FOUND opens the modal", async ({ page }) => {
  const query = new URLSearchParams({ googleError: "Bu Google hesabıyla kayıtlı bir hesap yok.", googleErrorCode: "AUTH_GOOGLE_ACCOUNT_NOT_FOUND" });
  await page.goto(`/giris?${query}`);
  await expect(card(page)).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  await card(page).getByRole("button", { name: "Kapat" }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test("coach CTAs open the waitlist as a coach while coach signup is closed", async ({ page }) => {
  const { joins } = await stubWaitlist(page);
  await page.goto("/koclar");
  await page.getByRole("main").getByRole("button", { name: "Koç olarak başla" }).first().click();
  await card(page).getByRole("textbox", { name: "E-posta adresin" }).fill("koc@test.local");
  await card(page).getByRole("button", { name: "Beni listeye ekle" }).click();
  await expect(card(page, SUCCESS)).toBeVisible();
  expect(joins).toEqual([{ email: "koc@test.local", role: "coach", locale: "tr" }]);

  await page.goto("/#koclar");
  await expect(page.locator("#koclar").getByRole("button", { name: "Koç olarak başla" })).toBeAttached();
});

test("English signup shows the English card", async ({ page }) => {
  await page.goto("/en/signup");
  await expect(card(page, "Let's save your spot!")).toBeVisible();
  await page.goto("/en/signup?davet=1");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("keyboard: open, fill, send, close returns focus; Escape closes", async ({ page }) => {
  await stubWaitlist(page);
  await page.goto("/");
  const trigger = page.getByRole("navigation", { name: "Ana menü" }).getByRole("button", { name: "Ücretsiz başla" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const field = card(page).getByRole("textbox", { name: "E-posta adresin" });
  await expect(field).toBeFocused();
  await page.keyboard.type("aday@test.local");
  await page.keyboard.press("Enter");
  const done = card(page, SUCCESS).getByRole("button", { name: "Tamam" });
  await expect(done).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card(page, SUCCESS)).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(card(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("open mode keeps the old links", async ({ page, request }) => {
  await setWaitlist(request, false);
  await page.goto("/");
  const start = page.getByRole("main").getByRole("link", { name: "Ücretsiz başla" }).first();
  await expect(start).toHaveAttribute("href", /\/hosgeldin$/);
  // Coach signup is closed on the fixture, so without the waitlist the coach band stays hidden.
  await expect(page.locator("#koclar")).toHaveCount(0);
  await start.click();
  await expect(page).toHaveURL(/\/hosgeldin$/);

  await page.goto("/kayit");
  await expect(page.locator('input[name="displayName"]')).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await page.goto("/giris");
  await expect(page.getByRole("link", { name: "Hesap oluştur" })).toHaveAttribute("href", /\/kayit$/);

  // An old coach invite link is an ordinary coach signup in open mode: the intake gate holds.
  await page.goto("/kayit?davet=1&rol=koc");
  await expect(page.getByRole("heading", { name: "Koç kaydı şu an kapalı" })).toBeVisible();
  await expect(page.locator('input[name="displayName"]')).toHaveCount(0);
});

test("reduced motion swaps the art without the glow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubWaitlist(page);
  await page.goto("/kayit");
  const art = card(page).locator(".lw-art");
  await expect(art.locator("img")).toHaveAttribute("src", /w1\.webp/);
  await card(page).getByRole("textbox", { name: "E-posta adresin" }).fill("aday@test.local");
  await card(page).getByRole("button", { name: "Beni listeye ekle" }).click();
  const successArt = card(page, SUCCESS).locator(".lw-art");
  await expect(successArt.locator("img")).toHaveAttribute("src", /w2\.webp/);
  await expect(successArt.locator("> div")).toHaveCount(0);
});
