import type { Page, Route } from "@playwright/test";
import { mockBlogAds } from "./blog-ads";
import { visionWithGoal } from "../vision-board-editor.fixture";

export const NOTEBOOK_ID = "99999999-9999-4999-8999-999999999999";

export async function mockOverviewAds(page: Page, options: Parameters<typeof mockBlogAds>[1] & { listError?: boolean } = {}) {
  const state = await mockBlogAds(page, { authenticated: true, examType: "YKS", ...options });
  await page.addInitScript(() => localStorage.setItem("mentor.analytics-consent.v1", "rejected"));
  await page.route("**/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/v1/ads/") || path.startsWith("/v1/auth/") || path === "/v1/users/me" || route.request().method() === "OPTIONS") return route.fallback();
    if (path === "/v1/coaching/notebooks") {
      if (options.listError) return json(route, { code: "TEMPORARY_ERROR", message: "Test error" }, 503);
      return json(route, { items: [{
        id: NOTEBOOK_ID, kind: "CUSTOM", examId: null, subjectRef: null, subjectName: null,
        title: "Çalışma defterim", cover: { color: "navy", material: "cloth" },
        pageCount: 1, dueCount: 0, updatedAt: "2026-10-01T00:00:00.000Z",
      }], total: 1, page: 1, pageSize: 12 });
    }
    if (path === `/v1/coaching/notebooks/${NOTEBOOK_ID}`) return json(route, {
      id: NOTEBOOK_ID, kind: "CUSTOM", title: "Çalışma defterim", examId: null, subjectRef: null,
      cover: { color: "navy", material: "cloth" }, pageCount: 1,
    });
    if (path.endsWith("/contents")) return json(route, { notebookId: NOTEBOOK_ID, pages: [] });
    if (/\/pages\/\d+$/.test(path)) return json(route, { pageIndex: 0, doc: { version: 1, paper: "ruled", items: [], ink: [] }, entries: [] });
    if (path === "/v1/coaching/vision") return json(route, visionWithGoal);
    if (path === "/v1/content/geo") return json(route, {
      cities: [{ code: "42", name: "Konya", slug: "konya", region: "IC_ANADOLU", universities: [] }],
      dataset: null, universitySource: null,
    });
    if (path.endsWith("/preference-simulation/access")) return json(route, { enabled: false });
    if (path.includes("/datasets") || path.endsWith("/subjects") || path.endsWith("/topics")) return json(route, []);
    if (path === "/v1/content/exams/by-type/YKS") return json(route, { id: "11111111-1111-4111-8111-111111111111", slug: "yks-2026", name: "YKS", family: "YKS" });
    if (path === "/v1/notifications") return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    if (path.endsWith("/stream-token")) return json(route, { token: "test-stream" });
    if (path.endsWith("/stream")) return route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
    return json(route, null, 204);
  });
  return state;
}

async function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", headers: {
    "access-control-allow-origin": route.request().headers().origin ?? "http://localhost:3000",
    "access-control-allow-credentials": "true",
  }, body: body === null ? "" : JSON.stringify(body) });
}
