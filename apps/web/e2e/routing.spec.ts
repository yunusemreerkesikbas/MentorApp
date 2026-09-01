import { expect, test } from "@playwright/test";
import { mockAnalysisApi } from "./analysis.fixture";

test("dil değiştirirken query değerini korur ve locale cookie yazmaz", async (
  { context, page },
  testInfo,
) => {
  test.skip(!testInfo.project.name.startsWith("desktop"));
  await mockAnalysisApi(page);
  await page.goto("/analiz?tab=progress");

  // `exact` matters: role-name matching is a substring match by default, and the desktop sidebar's
  // collapse button ("Menüyü daralt") happens to contain "en" as a literal substring.
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/analysis\?tab=progress$/);

  await page.getByRole("button", { name: "TR", exact: true }).click();
  await expect(page).toHaveURL(/\/analiz\?tab=progress$/);

  const localeCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "NEXT_LOCALE",
  );
  expect(localeCookie).toBeUndefined();
});

test("sitemap ve robots yalnız geçerli localized kökleri yayınlar", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => new URL(location).pathname,
  );
  expect(locations).not.toContain("/");
  expect(locations).not.toContain("/tr");
  expect(locations).not.toContain("/en");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).not.toContain("Disallow:");
  expect(robots).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
});

test("welcome ve private yüzeyler noindex direktifini crawler'a gösterir", async ({
  request,
}) => {
  const welcome = await (await request.get("/")).text();
  expect(welcome).toMatch(
    /<meta name="robots" content="noindex, follow"/i,
  );

  for (const path of [
    "/giris",
    "/masaya-katil",
    "/cerez-tercihleri",
    "/panel",
  ]) {
    const html = await (await request.get(path)).text();
    expect(html, `${path} robots metadata`).toMatch(
      /<meta name="robots" content="noindex, nofollow"/i,
    );
  }
});
