import { expect, test } from "@playwright/test";
import { getPathname } from "../src/i18n/navigation";
import { mockAnalysisApi } from "./analysis.fixture";

test("TR ve EN statik/dinamik route sözleşmesini çözer", () => {
  expect(getPathname({ locale: "tr", href: "/dashboard" })).toBe("/panel");
  expect(getPathname({ locale: "en", href: "/dashboard" })).toBe(
    "/en/dashboard",
  );
  expect(
    getPathname({
      locale: "tr",
      href: {
        pathname: "/knowledge/[slug]",
        params: { slug: "kpss-basvuru" },
      },
    }),
  ).toBe("/bilgi/kpss-basvuru");
  expect(
    getPathname({
      locale: "en",
      href: {
        pathname: "/community/message/[threadId]",
        params: { threadId: "thread-1" },
        query: { highlight: "comment-1" },
      },
    }),
  ).toBe("/en/community/message/thread-1?highlight=comment-1");
});

test("dil değiştirirken analiz sekmesi query değerini korur", async (
  { page },
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
});

test("sitemap ve robots yalnız geçerli localized kökleri yayınlar", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>http://localhost:3000/</loc>");
  expect(sitemap).not.toContain("localhost:3000/tr");
  expect(sitemap).not.toContain("localhost:3000/en");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /panel");
  expect(robots).toContain("Disallow: /en/dashboard");
});
