import { expect, test, type Page } from "@playwright/test";
import type { MentorshipFollowupDto } from "@mentor/types";

const STUDENT = "33333333-3333-4333-8333-333333333333";
const COACH = "22222222-2222-4222-8222-222222222222";
const initial: MentorshipFollowupDto = {
  id: "44444444-4444-4444-8444-444444444444", studentId: STUDENT, studentDisplayName: "Ayşe",
  title: "PRIVATE title", privateNote: "PRIVATE note", sharedDecision: "Haftayı birlikte değerlendirelim.",
  response: "PENDING", followUpDate: null, status: "OPEN", version: 1, replacesId: null,
  createdAt: "2026-09-12T07:00:00Z", updatedAt: "2026-09-12T07:00:00Z", respondedAt: null, closedAt: null,
};
async function mockApi(page: Page, coach: boolean, enabled = true) {
  let items: MentorshipFollowupDto[] = coach ? [] : [{ ...initial }];
  const writes: Record<string, unknown>[] = [];
  let failNextRead = false;
  const user = { id: coach ? COACH : STUDENT, email: "followups@test.local", displayName: "Test", username: "test", avatarUrl: null, bio: null, website: null, roles: coach ? ["STUDENT", "COACH"] : ["STUDENT"], organizationId: null, examType: "KPSS", examVariant: "LISANS", examDate: null, dailyFocusGoalMinutes: 60, emailVerified: true, createdAt: initial.createdAt };
  await page.route("**/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { "access-control-allow-origin": req.headers().origin ?? "http://localhost:3100", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, authorization, accept-language", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/v1/auth/refresh") return json({ accessToken: "test-token", expiresIn: 3600, user });
    if (path === "/v1/users/me") return json(user);
    if (path === "/v1/mentorship/followups/availability") return json({ enabled });
    if (path === `/v1/mentorship/students/${STUDENT}`) return json({ studentId: STUDENT, studentDisplayName: "Ayşe", studentUsername: "ayse", acceptedAt: initial.createdAt, studentExamType: null, coachNote: null, riskFlags: [], attendedAt: null, needsAttention: false, activity: { lastActiveDate: null, currentStreak: 0, longestStreak: 0, sessions7d: 0, focusMinutes7d: 0, activeDays7d: 0, sessions28d: 0, focusMinutes28d: 0, activeDays28d: 0 }, planCompletionRate7d: null, mockTrend: [], latestMockSubjects: [], planTasks: [], droppedAssignments: [], moodTrend: [] });
    if (path === `/v1/mentorship/students/${STUDENT}/followups` && req.method() === "POST") {
      const body = req.postDataJSON(); writes.push(body);
      const item = { ...initial, ...body, id: crypto.randomUUID() }; items.unshift(item);
      return json(item, 201);
    }
    if (path.startsWith(`/v1/mentorship/students/${STUDENT}/followups/`) && req.method() === "PATCH") {
      const body = req.postDataJSON(); writes.push(body);
      const index = items.findIndex((item) => path.endsWith(item.id));
      items[index] = { ...items[index]!, ...body, version: items[index]!.version + 1 };
      return json(items[index]);
    }
    if (path.endsWith("/response")) {
      const body = req.postDataJSON(); writes.push(body);
      items[0] = { ...items[0]!, response: body.response, version: items[0]!.version + 1 };
      const { title: _title, privateNote: _note, studentId: _student, studentDisplayName: _name, replacesId: _replaces, ...shared } = items[0];
      return json(shared);
    }
    if (path === "/v1/mentorship/followups" || path === "/v1/mentorship/my-coach/followups") {
      if (failNextRead) { failNextRead = false; return json({ code: "INTERNAL_ERROR", message: "Test tekrar dene" }, 500); }
      const visible = coach ? items : items.map(({ title: _title, privateNote: _note, studentId: _student, studentDisplayName: _name, replacesId: _replaces, ...item }) => item);
      return json({ items: visible, page: 1, pageSize: 10, total: visible.length });
    }
    if (path === "/v1/mentorship/my-coach") return json({ linkId: "link", coachDisplayName: "Koç Mert", coachUsername: "mert", status: "ACTIVE", acceptedAt: initial.createdAt, dataScope: [], coachNote: null, coachProfile: null, coachStatus: "ACTIVE" });
    if (path === "/v1/mentorship/templates") return json([]);
    if (path === "/v1/notifications") return json({ items: [], unreadCount: 0, total: 0 });
    if (path.startsWith("/v1/achievements") || path.startsWith("/v1/journey")) return json({ celebrations: [] });
    return route.fulfill({ status: 204, headers });
  });
  return { writes, failRead: () => { failNextRead = true; } };
}

test("coach creates, reschedules, closes and replaces a shared decision", async ({ page }) => {
  const api = await mockApi(page, true);
  await page.goto(`/kocluk/${STUDENT}`);
  await page.getByRole("button", { name: "Takip kaydı oluştur", exact: true }).click();
  await page.getByLabel(/Aksiyon başlığı/).fill("Haftalık görüşme");
  await page.getByLabel(/Koça özel not/).fill("Görüşme öncesi notum");
  await page.getByLabel(/Ortak karar/).fill("Bu hafta iki kısa oturum deneyelim.");
  await page.getByRole("button", { name: "Kaydet ve ortak kararı öğrenciyle paylaş" }).click();
  await expect(page.getByText("Yanıt bekliyor", { exact: true })).toBeVisible();
  expect(api.writes[0]).toHaveProperty("operationId");
  await page.getByLabel(/Tekrar kontrol tarihi/).fill("2099-01-01");
  await page.getByRole("button", { name: "Tarihi kaydet" }).click();
  await expect.poll(() => api.writes.length).toBe(2);
  await page.getByRole("button", { name: "Takibi tamamla" }).click();
  await expect(page.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yerine yeni kayıt oluştur" }).click();
  await page.getByLabel(/Aksiyon başlığı/).fill("Yeni karar");
  await page.getByRole("button", { name: "Yalnızca benim için kaydet" }).click();
  await expect.poll(() => api.writes.length).toBe(4);
  expect(api.writes[3]?.replacesId).toBeTruthy();
});

test("student only sees shared decisions and can change their response", async ({ page }) => {
  const api = await mockApi(page, false);
  await page.goto("/kocum");
  await expect(page.getByText(initial.sharedDecision!)).toBeVisible();
  await expect(page.getByText(/PRIVATE/)).toHaveCount(0);
  await page.getByRole("button", { name: "Kabul et", exact: true }).click();
  await expect(page.getByText("Kabul edildi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Değişiklik iste", exact: true }).click();
  await expect(page.getByText("Değişiklik istendi", { exact: true })).toBeVisible();
  expect(api.writes.map((item) => item.response)).toEqual(["ACCEPTED", "CHANGE_REQUESTED"]);
});

test("English error recovery and disabled feature", async ({ page }) => {
  const api = await mockApi(page, false);
  api.failRead();
  await page.goto("/en/my-coach");
  await expect(page.getByRole("alert").filter({ hasText: "Test tekrar dene" })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText(initial.sharedDecision!)).toBeVisible();
  await page.unroute("**/v1/**");
  await mockApi(page, false, false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Our shared decisions" })).toHaveCount(0);
});
