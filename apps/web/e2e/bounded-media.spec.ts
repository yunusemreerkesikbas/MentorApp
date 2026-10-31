import { browserApiUrl, browserWebOrigin } from "./api.fixture";
import { expect, test } from "@playwright/test";
import {
  BOARD_PHOTO_URL,
  ONE_PIXEL_PNG,
  boardPhoto,
  mockBoardApi,
  visionWithBoard,
} from "./vision-board-editor.fixture";
import { mockNotebookMedia } from "./bounded-media.fixture";
import { seedPublicMediaArticle } from "./bounded-public-media.fixture";
import { prepareTrialUser, trialApi } from "./core-trial.fixture";
import tr from "../messages/tr.json";

const unavailable = "Fotoğraf şu an görüntülenemiyor.";
test("photo refusal leaves the saved goal, plan and solo focus action usable", async ({
  page,
}) => {
  const fixture = await prepareTrialUser(page);
  const headers = { Authorization: `Bearer ${fixture.token}` };
  expect(
    (
      await page.request.post(`${trialApi}/coaching/vision`, {
        headers,
        data: { goalTitle: "Çalışma hedefim" },
      })
    ).status(),
  ).toBe(200);
  const key = `vision-board/${fixture.user.id}/${crypto.randomUUID()}.png`;
  const board = {
    version: 1,
    status: "DRAFT",
    frame: "wood",
    background: { kind: "texture", value: "cork" },
    items: [{ ...boardPhoto, storageKey: key, url: undefined }],
  };
  expect(
    (
      await page.request.put(`${trialApi}/coaching/vision/board`, {
        headers,
        data: { board },
      })
    ).status(),
  ).toBe(200);
  await page.route("**/v1/storage/fake-private-object**", (route) =>
    route.fulfill({ status: 503, body: "temporary" }),
  );
  await page.goto("/vision-board/board");
  await expect(page.getByText(unavailable)).toBeVisible();
  const saved = await page.request.get(`${trialApi}/coaching/vision`, {
    headers,
  });
  expect(await saved.json()).toMatchObject({
    goalTitle: "Çalışma hedefim",
    board: { items: [{ storageKey: key }] },
  });
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: tr.plan.title, exact: true }),
  ).toBeAttached();
  await page.goto("/seans");
  const started = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/v1/study-sessions",
  );
  await page
    .getByRole("button", { name: tr.session_controls.start, exact: true })
    .click();
  const response = await started;
  expect(response.status()).toBe(201);
  expect((await response.json()).roomId).toBeNull();
  expect(fixture.closedRequests).toEqual([]);
  expect(fixture.errors).toEqual([]);
});
test("public content photo failure preserves the readable article", async ({
  page,
}, info) => {
  const fixture = await seedPublicMediaArticle();
  try {
    await mockBoardApi(page);
    await page.route("**/storage/fake-object**", (route) =>
      route.fulfill({ status: 503, body: "temporary" }),
    );
    await page.goto(`/blog/${fixture.slug}`);
    await expect(
      page.getByRole("heading", { name: "Media fixture", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic media body", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(unavailable).first()).toBeVisible();
    await page.screenshot({
      path: info.outputPath("public-content-refused.png"),
    });
  } finally {
    await fixture.cleanup();
  }
});
test("a failed public avatar falls back without a broken image", async ({
  page,
}) => {
  await mockBoardApi(page);
  const { boardUser } = await import("./vision-board-editor.fixture");
  const avatar = `${browserApiUrl}/storage/media/public/avatars/fixture/photo.png`;
  const me = { ...boardUser, avatarUrl: avatar };
  await page.route("**/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": browserWebOrigin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        accessToken: "fixture-token",
        expiresIn: 3600,
        user: me,
      }),
    }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/v1/users/me"),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith("/phone")
        ? {
            verified: false,
            available: false,
            maskedPhoneNumber: null,
            reauthenticationRequired: false,
          }
        : path.endsWith("/google")
          ? {
              enabled: false,
              linked: false,
              providerEmail: null,
              canLink: false,
            }
          : me;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: {
          "access-control-allow-origin": browserWebOrigin,
          "access-control-allow-credentials": "true",
        },
      });
    },
  );
  let attempted = 0;
  await page.route(avatar, (route) => {
    attempted++;
    return route.fulfill({ status: 503, body: "temporary" });
  });
  await page.goto("/ayarlar");
  await expect(
    page.getByRole("button", { name: "Çıkış yap", exact: true }),
  ).toBeVisible();
  await expect.poll(() => attempted).toBeGreaterThan(0);
  // The hidden mobile navigation also owns a lazy image that has not made a request yet.
  await expect(page.locator(`img[src="${avatar}"]:visible`)).toHaveCount(0);
});
test("a late export cannot allocate a preview after its window closes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      __mediaClosed: boolean;
      __lateMediaUrls: number;
      __mediaDrawn: number;
    };
    state.__mediaClosed = false;
    state.__lateMediaUrls = 0;
    state.__mediaDrawn = 0;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (value) => {
      if (state.__mediaClosed) state.__lateMediaUrls++;
      return create(value);
    };
    const draw = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      return draw.call(
        this,
        (blob) => {
          state.__mediaDrawn++;
          callback(blob);
        },
        type,
        quality,
      );
    };
  });
  await mockBoardApi(page, {
    vision: visionWithBoard({ items: [boardPhoto] }),
  });
  let requests = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(BOARD_PHOTO_URL, async (route) => {
    requests++;
    if (requests > 1) await held;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
      headers: {
        "access-control-allow-origin": browserWebOrigin,
        "cache-control": "no-store",
      },
    });
  });
  await page.goto("/vision-board/board");
  await expect.poll(() => requests).toBe(1);
  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  await expect.poll(() => requests).toBeGreaterThan(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { __mediaClosed: boolean }).__mediaClosed = true;
  });
  release();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __mediaDrawn: number }).__mediaDrawn,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => (window as unknown as { __lateMediaUrls: number }).__lateMediaUrls,
    ),
  ).toBe(0);
});
test("notebook page and lightbox preserve the entry after photo refusal", async ({
  page,
}, info) => {
  await mockNotebookMedia(page);
  await page.goto("/yanlis-defteri");
  await page.getByRole("button", { name: "Defteri aç" }).click();
  await expect(
    page.getByRole("heading", { name: "İçindekiler" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(page.getByText(/^Sayfa 1(-2)?$/)).toBeVisible();
  await expect(page.getByText(unavailable).first()).toBeVisible();
  await page.getByRole("button", { name: /Fotoğrafı büyüt/ }).click();
  await expect(page.getByRole("dialog").getByText(unavailable)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Çalışma notum korunuyor").first(),
  ).toBeAttached();
  await page.screenshot({
    path: info.outputPath("notebook-media-refused.png"),
  });
});
test("temporary board media failure preserves items and can be retried", async ({
  page,
}, info) => {
  await mockBoardApi(page, {
    vision: visionWithBoard({ items: [boardPhoto] }),
    photo: "missing",
  });
  await page.goto("/vision-board/board");
  await expect(
    page.locator("[data-board-stage]").getByText(unavailable),
  ).toBeVisible();
  await page.route(BOARD_PHOTO_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
      headers: {
        "access-control-allow-origin": browserWebOrigin,
        "cache-control": "no-store",
      },
    }),
  );
  await page
    .locator("[data-board-stage]")
    .getByRole("button", { name: "Yeniden dene" })
    .click();
  await expect(page.locator("[data-board-stage] img")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Görsel", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("photo-recovered.png") });
});
test("required missing photos stop export and preserve the editor", async ({
  page,
}, info) => {
  await mockBoardApi(page, {
    vision: visionWithBoard({ items: [boardPhoto] }),
    photo: "missing",
  });
  await page.goto("/vision-board/board");
  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Panonu paylaş" });
  await expect(
    sheet.getByText(
      "Bir fotoğraf şu an açılamıyor. Panon duruyor; biraz sonra yeniden deneyebilirsin.",
    ),
  ).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "İndir", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("group", { name: "Görsel", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("export-stopped.png") });
});
test("an image still loading at logout cannot remain on screen", async ({
  page,
}) => {
  await mockBoardApi(page, {
    vision: visionWithBoard({ items: [boardPhoto] }),
    photo: "missing",
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route(BOARD_PHOTO_URL, async (route) => {
    requested = true;
    await held;
    await route
      .fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG })
      .catch(() => {});
  });
  await page.goto("/vision-board/board");
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("mentor-auth-session-event-v1");
    channel.postMessage("logout");
    channel.close();
  });
  await expect(page.locator("[data-board-stage]")).toHaveCount(0);
  release();
  await expect(page.locator(`img[src="${BOARD_PHOTO_URL}"]`)).toHaveCount(0);
});
