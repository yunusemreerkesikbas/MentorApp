import { expect, test, type Page } from "@playwright/test";

const email = "hydration-check@example.invalid";
const password = "HydrationCheck123";
const authPages = [
  { paths: ["/giris", "/en/login"], endpoint: "login" },
  { paths: ["/kayit?davet=1", "/en/signup?davet=1"], endpoint: "signup" },
  { paths: ["/sifremi-unuttum", "/en/forgot-password"], endpoint: "forgot-password" },
  { paths: ["/sifre-sifirla?token=hydration-check", "/en/reset-password?token=hydration-check"], endpoint: "reset-password" },
];

async function fillForm(page: Page) {
  for (const [name, value] of [["email", email], ["password", password], ["displayName", "Hydration Check"]]) {
    const input = page.locator(`input[name="${name}"]`);
    if (await input.count()) await input.fill(value);
  }
}

async function rejectAuthRequests(page: Page) {
  await page.route("**/v1/auth/**", (route) => route.fulfill({
    status: route.request().method() === "OPTIONS" ? 204 : 400,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": new URL(page.url()).origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "content-type",
    },
    body: JSON.stringify({ code: "VALIDATION_ERROR", message: "Hydration regression check" }),
  }));
}

for (const { paths, endpoint } of authPages) {
  for (const path of paths) {
    test(`no JavaScript: ${path} cannot submit private fields`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        expect((await page.goto(path))?.status()).toBe(200);
        const form = page.locator("main form");
        // Invite-only signup and the reset Suspense boundary can require client rendering.
        if ((endpoint === "signup" || endpoint === "reset-password") && !(await form.count())) {
          await expect(page.locator("main")).toBeVisible();
          await expect(page.locator('input[name="password"]:visible')).toHaveCount(0);
          return;
        }
        await expect(form).toBeVisible();
        await expect(form).toHaveAttribute("method", "post");
        const submit = form.locator('button[type="submit"]');
        await expect(submit).toBeDisabled();
        await fillForm(page);
        // Exercise the hydration guard independently of required legal checkboxes.
        await form.evaluate((element: HTMLFormElement) => { element.noValidate = true; });
        const navigations: string[] = [];
        page.on("request", (request) => {
          if (request.isNavigationRequest()) navigations.push(request.method());
        });
        await form.locator("input").last().press("Enter");
        await submit.click({ force: true });
        await page.waitForTimeout(200);
        expect(navigations).toEqual([]);
        expect(new URL(page.url()).searchParams.has("password")).toBe(false);
        expect(new URL(page.url()).searchParams.has("email")).toBe(false);
      } finally {
        await context.close();
      }
    });

    test(`hydrated: ${path} submits only to the identity API`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await rejectAuthRequests(page);
      await page.goto(path);
      const form = page.locator("main form");
      await expect(form).toBeVisible();
      await expect(form).toHaveAttribute("method", "post");
      const submit = form.locator('button[type="submit"]');
      await expect(submit).toBeEnabled();
      await fillForm(page);
      for (const name of ["kvkk", "terms"]) {
        const checkbox = form.locator(`input[name="${name}"]`);
        if (await checkbox.count()) await checkbox.locator("..").getByRole("checkbox").check();
      }
      const submitted = page.waitForRequest((request) =>
        new URL(request.url()).pathname === `/v1/auth/${endpoint}` && request.method() === "POST",
      );
      await submit.click();
      const request = await submitted;
      expect(request.isNavigationRequest()).toBe(false);
      expect(new URL(request.url()).search).toBe("");
      const body = request.postDataJSON() as Record<string, unknown>;
      if (endpoint !== "reset-password") expect(body.email).toBe(email);
      if (endpoint !== "forgot-password") expect(body.password).toBe(password);
      await expect(form.getByRole("alert")).toContainText("Hydration regression check");
      expect(new URL(page.url()).searchParams.has("password")).toBe(false);
      expect(new URL(page.url()).searchParams.has("email")).toBe(false);
    });
  }
}

test("native submission fallback keeps private fields out of the URL", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/giris");
    await fillForm(page);
    await page.route("**/giris*", (route) => route.abort());
    const submitted = page.waitForRequest((request) => request.isNavigationRequest());
    await page.locator("main form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    const request = await submitted;
    expect(request.method()).toBe("POST");
    expect(new URL(request.url()).search).toBe("");
    const body = new URLSearchParams(request.postData() ?? "");
    expect(body.get("email")).toBe(email);
    expect(body.get("password")).toBe(password);
  } finally {
    await context.close();
  }
});

test("slow JavaScript: login stays locked until its submit handler is ready", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route("**/_next/**/*.js*", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  await rejectAuthRequests(page);
  try {
    await page.goto("/giris", { waitUntil: "commit" });
    const submit = page.locator('main form button[type="submit"]');
    await expect(submit).toBeDisabled();
    await fillForm(page);
    const navigations: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest()) navigations.push(request.method());
    });
    await page.locator('input[name="password"]').press("Enter");
    await submit.click({ force: true });
    await page.waitForTimeout(200);
    expect(navigations).toEqual([]);
    releaseScripts();
    await expect(submit).toBeEnabled();
    const submitted = page.waitForRequest("**/v1/auth/login");
    await page.locator('input[name="password"]').press("Enter");
    expect((await submitted).method()).toBe("POST");
    await expect(page.locator("main form").getByRole("alert")).toContainText("Hydration regression check");
  } finally {
    releaseScripts();
  }
});
