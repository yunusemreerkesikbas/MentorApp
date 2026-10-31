import { browserWebOrigin } from "./api.fixture";
import type { NotebookEntryDto, NotebookPageDto } from "@mentor/types";
import type { Page } from "@playwright/test";
import {
  BOARD_PHOTO_URL,
  boardUser,
  mockBoardApi,
} from "./vision-board-editor.fixture";

export const mediaEntry: NotebookEntryDto = {
  id: "33333333-3333-4333-8333-333333333333",
  mockExamId: null,
  storageKey: `notebook/${boardUser.id}/photo.png`,
  url: BOARD_PHOTO_URL,
  subjectRef: "matematik",
  subjectName: "Matematik",
  topicRef: null,
  topicName: null,
  errorType: "CARELESS",
  note: "Çalışma notum korunuyor",
  solutionStorageKey: null,
  solutionUrl: null,
  solutionNote: null,
  status: "ACTIVE",
  reviewCount: 1,
  lastReviewedAt: null,
  nextReviewAt: null,
  source: "OWN",
  communityThreadId: null,
  communityAnsweredAt: null,
  createdAt: "2026-08-10T09:00:00Z",
  updatedAt: "2026-08-10T09:00:00Z",
};

/** Local browser data only; the gateway/session/SQL behavior has its own actual HTTP suite. */
export async function mockNotebookMedia(page: Page) {
  await mockBoardApi(page, { photo: "missing" });
  const saved: unknown[] = [];
  const book = {
    id: "99999999-9999-4999-8999-999999999999",
    kind: "MISTAKE",
    examId: null,
    subjectRef: null,
    subjectName: null,
    title: null,
    cover: { color: "navy", material: "cloth" },
    pageCount: 1,
    dueCount: 0,
    updatedAt: "2026-08-10T09:00:00Z",
  };
  const doc: NotebookPageDto["doc"] = {
    version: 1,
    paper: "ruled",
    ink: [],
    items: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        kind: "entry",
        entryId: mediaEntry.id,
        x: 170,
        y: 90,
        width: 800,
        height: 300,
        rotation: 0,
        opacity: 1,
        z: 1,
      },
    ],
  };
  await page.route(
    (url) => url.pathname.startsWith("/v1/coaching/notebook"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const respond = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
          headers: {
            "access-control-allow-origin": browserWebOrigin,
            "access-control-allow-credentials": "true",
          },
        });
      if (method === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": browserWebOrigin,
            "access-control-allow-methods": "GET,PUT,PATCH",
            "access-control-allow-headers": "authorization,content-type",
          },
        });
      if (path.endsWith("/notebook"))
        return respond({
          ...book,
          pageCount: 1,
          entryCount: 1,
          dueCount: 0,
          healedCount: 0,
          notebook: book,
        });
      if (path.endsWith("/reviews/due")) return respond([]);
      if (path.endsWith("/entries"))
        return respond({
          items: [mediaEntry],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      if (path.endsWith("/contents"))
        return respond({ notebookId: book.id, pages: [] });
      const pageMatch = path.match(/\/pages\/(\d+)$/);
      if (pageMatch) {
        const index = Number(pageMatch[1]);
        if (method === "PUT") saved.push(route.request().postDataJSON());
        return respond({
          pageIndex: index,
          doc:
            index === 0
              ? doc
              : { version: 1, paper: "ruled", ink: [], items: [] },
          entries: index === 0 ? [mediaEntry] : [],
        });
      }
      return route.fallback();
    },
  );
  return { saved };
}
