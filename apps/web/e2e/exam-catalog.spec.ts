import { expect, test, type Page } from "@playwright/test";
import type { AuthUser, ExamType } from "@mentor/types";
import { browserApiUrl } from "./api.fixture";
import { gotoAnalysis, mockAnalysisApi, user as existingUser } from "./analysis.fixture";

async function mockOnboarding(page: Page, coach: boolean) {
  let user: AuthUser = {
    ...existingUser, username: null, examType: null, examVariant: null, examDate: null,
    roles: coach ? ["STUDENT", "COACH"] : ["STUDENT"],
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(`${browserApiUrl}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://localhost:3100",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, accept-language",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/v1/auth/refresh") return json({ accessToken: "test-token", expiresIn: 3600, user });
    if (request.method() === "PATCH" && path === "/v1/users/me") {
      user = { ...user, ...request.postDataJSON() };
      return json(user);
    }
    if (path === "/v1/coaching/vision") return json(null);
    return route.fulfill({ status: 204, headers });
  });
  return { currentUser: () => user };
}

for (const examType of ["ALES", "DGS"] as const) {
  for (const coach of [false, true]) {
    test(`exam catalogue: ${examType} ${coach ? "coach" : "student"} onboarding`, async ({ page }) => {
      const api = await mockOnboarding(page, coach);
      await page.goto("/onboarding");
      await page.getByRole("button", { name: "Devam", exact: true }).click();
      await expect(page.getByRole("radio")).toHaveCount(5);
      await page.getByRole("radio", { name: new RegExp(`^${examType}\\b`) }).click();
      await page.getByRole("button", { name: "Devam", exact: true }).click();
      await expect.poll(api.currentUser).toMatchObject({ examType, examVariant: null });
      await expect(page.getByRole("heading", {
        name: coach ? "Öğrenciye kendini nasıl anlatalım?" : "Bu sınav senin için ne demek?",
      })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (!coach) {
        await page.getByRole("button", { name: "Şimdilik geç" }).click();
        await page.getByRole("button", { name: "Şimdilik geç" }).click();
        await page.getByRole("spinbutton", { name: "Kendin yaz" }).fill("60");
        await page.getByRole("button", { name: "Devam", exact: true }).click();
        await page.getByLabel("Kullanıcı adı").fill(`deniz_${examType.toLowerCase()}`);
        await page.getByRole("button", { name: "Devam", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Yolun hazır." })).toBeVisible();
        await expect(page.getByRole("list", { name: "Seçimlerin" })).toContainText(examType);
      }
    });
  }

  test(`exam catalogue: ${examType} analysis submits its own numerical/verbal sections`, async ({ page }) => {
    const api = await mockAnalysisApi(page, { authUser: { ...existingUser, examType, examVariant: null } });
    const exam = {
      id: examType === "ALES" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      slug: examType === "ALES" ? "ales-3-2026" : "dgs-2027",
      family: examType as ExamType, name: examType, variant: null, isCurrent: true,
    };
    await page.route(`${browserApiUrl}/content/exams/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith("/subjects")
        ? [
          { slug: `${examType.toLowerCase()}-sayisal`, name: `${examType} Sayısal`, questionCount: 50, sortOrder: 0 },
          { slug: `${examType.toLowerCase()}-sozel`, name: `${examType} Sözel`, questionCount: 50, sortOrder: 1 },
        ]
        : path.endsWith("/topics") ? []
          : path.endsWith("/calendar") ? null : exam;
      await route.fulfill({
        status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3100", "access-control-allow-credentials": "true" },
        body: JSON.stringify(body),
      });
    });
    await gotoAnalysis(page, "/analiz");
    await page.getByRole("button", { name: "Deneme ekle", exact: true }).click();
    const numerical = page.getByRole("group", { name: new RegExp(`${examType} Sayısal`) });
    await numerical.getByLabel("Doğru", { exact: true }).fill("40");
    await numerical.getByLabel("Yanlış", { exact: true }).fill("8");
    await expect(numerical.getByLabel("Boş", { exact: true })).toHaveValue("2");
    const verbal = page.getByRole("group", { name: new RegExp(`${examType} Sözel`) });
    await verbal.getByLabel("Doğru", { exact: true }).fill("45");
    await verbal.getByLabel("Yanlış", { exact: true }).fill("4");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => api.createdMockExams).toHaveLength(1);
    expect(api.createdMockExams[0]).toMatchObject({
      examId: exam.id,
      subjects: [
        { subjectRef: `${examType.toLowerCase()}-sayisal`, correct: 40, wrong: 8, blank: 2 },
        { subjectRef: `${examType.toLowerCase()}-sozel`, correct: 45, wrong: 4, blank: 1 },
      ],
    });
    await expect(page.getByTestId("analysis-saved")).toBeVisible();
  });
}
