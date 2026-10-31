import type { Locator, Page, Route } from "@playwright/test";
import type { AuthUser, VisionBoardDoc, VisionBoardItem, VisionDto, ZoneView } from "@mentor/types";
import { browserApiOrigin } from "./api.fixture";

/**
 * What the collage editor's scenarios stand on: a signed-in student with a goal, the API the editor
 * talks to (answered in the test, never by a server), and a few measurements.
 */

const API_ORIGIN = browserApiOrigin;

export const boardUser: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "pano@test.local",
  displayName: "Pano Test",
  username: "pano_test",
  avatarUrl: null,
  bio: null,
  website: null,
  roles: ["STUDENT"],
  organizationId: null,
  examType: "YKS",
  examVariant: null,
  examDate: "2026-06-20",
  dailyFocusGoalMinutes: null,
  careerGroup: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/** A goal with no board yet: the editor seeds the collage from it ("Bilgisayar Mühendisi", "Konya"). */
export const visionWithGoal: VisionDto = {
  goalTitle: "Bilgisayar Mühendisi",
  targetCityCode: "42",
  targetCity: null,
  targetUniversityId: null,
  targetTitleId: null,
  targetInstitutionId: null,
  careerGroup: "YAZILIM",
  motivation: null,
  aiNote: null,
  board: null,
  targetNames: { cityName: "Konya", universityName: null, titleName: null, institutionName: null },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

/** Where a board photo is served from in these tests; the fixture decides what answers there. */
export const BOARD_PHOTO_URL = `${API_ORIGIN}/v1/storage/board-photo`;

/** A photo with no frame of its own, so the picture's pixels start at the item's own corner. */
export const boardPhoto: VisionBoardItem = {
  id: "77777777-7777-4777-8777-777777777777",
  kind: "image",
  storageKey: "vision/board/photo.png",
  url: BOARD_PHOTO_URL,
  frame: "none",
  x: 100,
  y: 100,
  width: 400,
  height: 500,
  rotation: 0,
  opacity: 1,
  z: 1,
};

export function visionWithBoard(board: Partial<VisionBoardDoc>): VisionDto {
  return {
    ...visionWithGoal,
    board: {
      version: 1,
      status: "DRAFT",
      frame: "wood",
      background: { kind: "texture", value: "cork" },
      items: [],
      ...board,
    },
  };
}

/** A chat room the viewer belongs to: the only kind a picture post can go to. */
export const chatRoom: ZoneView = {
  id: "55555555-5555-4555-8555-555555555555",
  type: "CHAT",
  title: "YKS sohbet",
  slug: "yks-sohbet",
  description: null,
  visibility: "PUBLIC",
  joinPolicy: "OPEN",
  examType: "YKS",
  isArchived: false,
  memberCount: 12,
  threadCount: 3,
  myStatus: "ACTIVE",
  myRole: "MEMBER",
  canModerate: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

/** A valid 1×1 PNG, for a file the editor has to be able to decode. */
export const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

/** Solid magenta, a colour no board texture, frame or placeholder uses. */
const MAGENTA_PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#ff00ff"/></svg>`;

export interface BoardApiOptions {
  vision?: VisionDto | null;
  /** The viewer's community rooms; null leaves the forum unanswered, as when it is switched off. */
  zones?: ZoneView[] | null;
  /** Makes the post itself fail the way the API does: a status and its `{ code, message }`. */
  threadFailure?: { status: number; code: string; message: string };
  /** What answers at `BOARD_PHOTO_URL`. */
  photo?: "magenta" | "missing";
}

export async function mockBoardApi(page: Page, options: BoardApiOptions = {}) {
  const { vision = visionWithGoal, zones = null, threadFailure, photo = "magenta" } = options;
  const boardPuts: VisionBoardDoc[] = [];
  const imageUploads: string[] = [];
  const forumUploads: string[] = [];
  const threads: unknown[] = [];

  // Dismiss the analytics consent bar up front: it docks over the bottom of the page.
  await page.addInitScript(() =>
    window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  );

  await page.route(`${API_ORIGIN}/v1/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user: boardUser });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, boardUser);
    // The app chrome's notification drawer reads `.items`; a bare 204 would take the page down.
    if (method === "GET" && path === "/v1/notifications") {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path === "/v1/notifications/stream") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }

    if (method === "GET" && path === "/v1/coaching/vision") {
      return vision ? json(route, vision) : json(route, null, 204);
    }
    if (method === "PUT" && path === "/v1/coaching/vision/board") {
      const { board } = request.postDataJSON() as { board: VisionBoardDoc };
      boardPuts.push(board);
      return json(route, { ...vision, board });
    }

    // A photo on its way onto the board: the presigned URL, then the bytes.
    if (method === "POST" && path === "/v1/coaching/vision/board/image-upload-url") {
      return json(route, {
        uploadUrl: "/v1/storage/fake-board-upload",
        key: "vision/board/uploaded.png",
        expiresAt: "2026-08-01T00:10:00.000Z",
        maxBytes: 5 * 1024 * 1024,
      });
    }
    if (method === "PUT" && path === "/v1/storage/fake-board-upload") {
      imageUploads.push(request.headers()["content-type"] ?? "");
      return json(route, null, 204);
    }
    // A photo already on the board, read back by the exporter with a CORS request.
    if (method === "GET" && path === "/v1/storage/board-photo") {
      if (photo === "missing") return json(route, null, 404);
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        headers: corsHeaders,
        body: MAGENTA_PHOTO,
      });
    }

    // A board shared to the community: its rooms, the picture's upload, then the post itself.
    if (zones && method === "GET" && path === "/v1/forum/zones") {
      return json(route, { items: zones, total: zones.length, page: 1, pageSize: 100 });
    }
    if (method === "POST" && path === "/v1/forum/attachments/upload-url") {
      return json(route, {
        uploadUrl: "/v1/storage/fake-forum-upload",
        key: "forum/board.jpg",
        expiresAt: "2026-08-01T00:10:00.000Z",
        maxBytes: 5 * 1024 * 1024,
      });
    }
    if (method === "PUT" && path === "/v1/storage/fake-forum-upload") {
      forumUploads.push(request.headers()["content-type"] ?? "");
      return json(route, null, 204);
    }
    if (method === "POST" && /^\/v1\/forum\/zones\/[^/]+\/threads$/.test(path)) {
      if (threadFailure) {
        const { status, code, message } = threadFailure;
        return json(route, { code, message }, status);
      }
      threads.push({ zoneId: path.split("/")[4], ...(request.postDataJSON() as object) });
      return json(route, { id: "thread-1" });
    }

    return json(route, null, 204);
  });

  return { boardPuts, imageUploads, forumUploads, threads };
}

const corsHeaders = {
  "access-control-allow-origin":
    process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}

/** The editor's own breakpoint: from `lg` the rail and the panel float beside the board. */
export function isWide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected the element to be laid out");
  return box;
}

/** An image's own pixel size, zero until it has loaded. */
export function naturalSize(image: Locator) {
  return image.evaluate((element: HTMLImageElement) => ({
    width: element.naturalWidth,
    height: element.naturalHeight,
  }));
}

/** One pixel of a loaded image, as `[r, g, b]`. */
export function pixelAt(image: Locator, x: number, y: number) {
  return image.evaluate(
    (element: HTMLImageElement, point) => {
      const canvas = document.createElement("canvas");
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(element, 0, 0);
      return Array.from(ctx.getImageData(point.x, point.y, 1, 1).data.slice(0, 3));
    },
    { x, y },
  );
}

/** Presses the window's "İndir" and hands back the file the browser was given. */
export async function downloadFrom(page: Page, sheet: Locator) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet.getByRole("button", { name: "İndir" }).click(),
  ]);
  return download;
}
