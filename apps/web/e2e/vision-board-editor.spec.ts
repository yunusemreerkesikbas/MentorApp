import { expect, test } from "@playwright/test";
import type { ZoneView } from "@mentor/types";
import {
  ONE_PIXEL_PNG,
  boardPhoto,
  boxOf,
  chatRoom,
  downloadFrom,
  isWide,
  mockBoardApi,
  naturalSize,
  pixelAt,
  visionWithBoard,
} from "./vision-board-editor.fixture";

/**
 * The collage editor (`/vision-board/board`), scenario by scenario, on both projects. The API is
 * answered by `mockBoardApi`: this is evidence about the screen, not about the server.
 */

test("VB-01 seçili araç siyahla değil seçili çip rengiyle görünür", async ({ page }, testInfo) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const boardTab = page.getByRole("button", { name: "Pano", exact: true });
  // A phone opens on the board with the sheet shut; beside the board the panel starts open.
  if (!isWide(page)) await boardTab.click();
  await expect(boardTab).toHaveAttribute("aria-pressed", "true");
  await testInfo.attach("editor", { body: await page.screenshot(), contentType: "image/png" });
  // The label wears `--play-selected-ink` and the fill behind it `--play-selected` (DESIGN.md §6);
  // `--color-btn` (black) is navigation chrome and must not come back here.
  const colors = await boardTab.evaluate((button) => {
    const root = getComputedStyle(document.documentElement);
    const probe = document.createElement("span");
    document.body.append(probe);
    const resolve = (token: string) => {
      probe.style.color = root.getPropertyValue(token);
      return getComputedStyle(probe).color;
    };
    const expected = { ink: resolve("--play-selected-ink"), fill: resolve("--play-selected") };
    probe.remove();
    return {
      ink: getComputedStyle(button).color,
      fill: getComputedStyle(button.querySelector("span[aria-hidden]")!).backgroundColor,
      expected,
    };
  });
  expect(colors.ink).toBe(colors.expected.ink);
  expect(colors.fill).toBe(colors.expected.fill);
});

test("VB-02 panel panoyu örtmez, karşılama ilk eklemeyle gider", async ({ page }, testInfo) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const board = page.locator("[data-board-stage]");
  const panelTitle = page.getByRole("heading", { name: "Pano", exact: true });
  const panel = panelTitle.locator("xpath=ancestor::aside");
  const welcome = page.getByText("Panon seni bekliyor.");
  await expect(board).toBeVisible();
  await expect(welcome).toBeVisible();

  if (isWide(page)) {
    // Beside the rail: the board steps aside for the panel, and takes the room back when it shuts.
    await expect(panelTitle).toBeVisible();
    const openBoard = await boxOf(board);
    const openPanel = await boxOf(panel);
    expect(openBoard.x).toBeGreaterThanOrEqual(openPanel.x + openPanel.width);
    await page.getByRole("button", { name: "Paneli kapat" }).click();
    await expect(panelTitle).toBeHidden();
    await expect.poll(async () => (await board.boundingBox())?.x).toBeLessThan(openBoard.x);
  } else {
    // On a phone the board comes first; the sheet rises under it from the dock.
    await expect(panelTitle).toBeHidden();
    await page.getByRole("button", { name: "Pano", exact: true }).click();
    await expect(panelTitle).toBeVisible();
    const openBoard = await boxOf(board);
    const openPanel = await boxOf(panel);
    expect(openBoard.y + openBoard.height).toBeLessThanOrEqual(openPanel.y);
  }
  await testInfo.attach("layout", { body: await page.screenshot(), contentType: "image/png" });

  await page.getByRole("button", { name: "Metin", exact: true }).click();
  await page.getByRole("button", { name: "Metin kutusu ekle" }).click();
  await expect(welcome).toBeHidden();
});

test("VB-03 çerçeve kutucukla seçilir, ok tuşu öğeyi kaydırır", async ({ page }, testInfo) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  // Frames are pictured tiles, and "no frame" is a choice of its own rather than a second tap.
  if (!isWide(page)) await page.getByRole("button", { name: "Pano", exact: true }).click();
  const noFrame = page.getByRole("button", { name: "Çerçevesiz" });
  await noFrame.click();
  await expect(noFrame).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Ahşap" })).toHaveAttribute("aria-pressed", "false");
  await testInfo.attach("tiles", { body: await page.screenshot(), contentType: "image/png" });

  // An item is a tab stop: focus selects it, an arrow moves it, and one undo takes the move back.
  const headline = page.getByRole("group", { name: "Metin: Bilgisayar Mühendisi" });
  await headline.focus();
  const start = await boxOf(headline);
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await boxOf(headline)).x).toBeGreaterThan(start.x);
  await expect.poll(async () => (await boxOf(headline)).y).toBe(start.y);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await boxOf(headline)).x).toBe(start.x);
});

test("VB-04 paylaşım penceresi: çerçeveli görsel ve duvar kâğıdı indirilir", async ({
  page,
}, testInfo) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Panonu paylaş" });
  await expect(sheet).toBeVisible();
  // Without a forum to post to (it is unanswered here), the community row is not offered.
  await expect(sheet.getByRole("button", { name: "Toplulukta paylaş" })).toHaveCount(0);

  // The picture wears the frame: the 1620×1080 board at 2×, plus the wood moulding and the mat
  // (4.8% of the framed width on each side). A bare board would be 3240×2160.
  const board = sheet.getByRole("img", { name: "Panonun görseli" });
  await expect.poll(() => naturalSize(board)).toEqual({ width: 3584, height: 2504 });
  await testInfo.attach("sheet", { body: await page.screenshot(), contentType: "image/png" });
  const boardFile = await downloadFrom(page, sheet);
  expect(boardFile.suggestedFilename()).toBe("hedef-panom.png");
  await testInfo.attach("board-png", { path: await boardFile.path(), contentType: "image/png" });

  await sheet.getByRole("button", { name: "Duvar kâğıdı" }).click();
  const wallpaper = sheet.getByRole("img", { name: "Panonun duvar kâğıdı hali" });
  await expect.poll(() => naturalSize(wallpaper)).toEqual({ width: 1170, height: 2532 });
  const wallpaperFile = await downloadFrom(page, sheet);
  expect(wallpaperFile.suggestedFilename()).toBe("hedef-panom-duvar-kagidi.png");
  await testInfo.attach("wallpaper-png", {
    path: await wallpaperFile.path(),
    contentType: "image/png",
  });
});

test("VB-05 pano toplulukta paylaşılır: görsel yüklenir, gönderi odaya düşer", async ({
  page,
}, testInfo) => {
  const otherRoom: ZoneView = {
    ...chatRoom,
    id: "66666666-6666-4666-8666-666666666666",
    title: "Genel sohbet",
    slug: "genel-sohbet",
  };
  const api = await mockBoardApi(page, { zones: [otherRoom, chatRoom] });
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Toplulukta paylaş" }).click();
  await expect(sheet.getByRole("heading", { name: "Toplulukta paylaş" })).toBeVisible();

  // Two rooms, so one has to be picked: the post waits for a room and for a note.
  const post = sheet.getByRole("button", { name: "Paylaş", exact: true });
  await sheet.getByLabel("Notun").fill("Hedefim burada duruyor.");
  await expect(post).toBeDisabled();
  await sheet.getByRole("button", { name: "Oda" }).click();
  await page.getByRole("option", { name: "YKS sohbet" }).click();
  await testInfo.attach("community", { body: await page.screenshot(), contentType: "image/png" });
  await post.click();

  // The window gives way to a toast that leads to the post.
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Panon toplulukta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gönderiyi gör" })).toBeVisible();
  // The framed board went up as a JPEG, and the post carries it with the note.
  expect(api.forumUploads).toEqual(["image/jpeg"]);
  expect(api.threads).toEqual([
    {
      zoneId: chatRoom.id,
      body: "Hedefim burada duruyor.",
      attachments: [{ key: "forum/board.jpg", mimeType: "image/jpeg", width: 3584, height: 2504 }],
    },
  ]);
});

test("VB-06 açık kategoriye dokunmak paneli kapatır, yeniden dokunmak açar, Escape kapatır", async ({
  page,
}) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const tab = page.getByRole("button", { name: "Pano", exact: true });
  const title = page.getByRole("heading", { name: "Pano", exact: true });
  if (!isWide(page)) await tab.click();
  await expect(title).toBeVisible();

  // The toggle once sat inside a state updater: Strict Mode ran it twice and nothing closed.
  await tab.click();
  await expect(title).toBeHidden();
  await expect(tab).toHaveAttribute("aria-pressed", "false");
  await tab.click();
  await expect(title).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(title).toBeHidden();
});

test("VB-07 paylaşım penceresi açıkken Delete arkadaki seçili öğeyi silmez", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const subtitle = page.getByRole("group", { name: "Metin: Konya" });
  await subtitle.focus();
  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "Kapat" }).focus();
  await page.keyboard.press("Delete");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(subtitle).toBeVisible();

  // On the board itself the same key does remove the selection.
  await subtitle.focus();
  await page.keyboard.press("Delete");
  await expect(subtitle).toHaveCount(0);
});

test("VB-08 öğe seçmek masaüstünde panelini açar, telefonda açmaz; araç çubuğu panoyu örtmez", async ({
  page,
}) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const board = page.locator("[data-board-stage]");
  await page.getByRole("group", { name: "Metin: Bilgisayar Mühendisi" }).click();
  const toolbar = page.getByRole("toolbar", { name: "Seçim araçları" });
  await expect(toolbar).toBeVisible();
  const textPanel = page.getByRole("heading", { name: "Metin", exact: true });

  if (isWide(page)) {
    // Beside the board the item's controls open with it, and its toolbar sits above the board.
    await expect(textPanel).toBeVisible();
    await expect
      .poll(async () => {
        const [bar, stage] = [await boxOf(toolbar), await boxOf(board)];
        return bar.y + bar.height <= stage.y;
      })
      .toBe(true);
  } else {
    // A sheet that rose on every tap would cover the board being arranged. The toolbar keeps to
    // the row between the board and the dock.
    await expect(textPanel).toBeHidden();
    const dock = page.getByRole("navigation", { name: "Pano araçları" });
    await expect
      .poll(async () => {
        const [bar, stage, nav] = [await boxOf(toolbar), await boxOf(board), await boxOf(dock)];
        return bar.y >= stage.y + stage.height && bar.y + bar.height <= nav.y;
      })
      .toBe(true);
  }
});

test("VB-09 çerçeve kalınlığı pencereye değil panoya oranlıdır", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const stage = page.locator("[data-board-stage]");
  await expect(stage).toBeVisible();
  // The size container, the moulding and the mat wrap the stage, in that order.
  const frame = stage.locator("xpath=../../..");
  const [stageBox, frameBox] = [await boxOf(stage), await boxOf(frame)];
  // Wood: a 2.2% moulding and a 2.6% mat on each side of the framed width, whatever the window's.
  // Sized against the window instead, a 1280px desktop comes to about 6.4%.
  expect((frameBox.width - stageBox.width) / 2 / frameBox.width).toBeCloseTo(0.048, 2);
});

test("VB-10 doku kutucuğu panonun arka planını değiştirir", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const stage = page.locator("[data-board-stage]");
  // Cork, the seeded board's texture.
  await expect(stage).toHaveCSS("background-color", "rgb(216, 176, 131)");
  if (!isWide(page)) await page.getByRole("button", { name: "Pano", exact: true }).click();
  const grid = page.getByRole("button", { name: "Izgara" });
  await grid.click();

  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("VB-11 yazı tipi seçmek seçili metnin yazı tipini değiştirir", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const headline = page.getByRole("group", { name: "Metin: Bilgisayar Mühendisi" });
  const words = headline.getByText("Bilgisayar Mühendisi");
  const fontOf = () => words.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(await fontOf()).toContain("Poppins");

  await headline.click();
  // The phone lines the category up without raising the sheet; the dock opens it.
  if (!isWide(page)) await page.getByRole("button", { name: "Metin", exact: true }).click();
  await page.getByRole("button", { name: "Caveat" }).click();

  await expect.poll(fontOf).toContain("Caveat");
});

test("VB-12 Tab bir sonraki öğeye geçer, Enter metni yazmaya açar", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const headline = page.getByRole("group", { name: "Metin: Bilgisayar Mühendisi" });
  await headline.focus();
  // The selection's resize and rotate handles answer only a pointer, so they are not tab stops.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("group", { name: "Metin: Konya" })).toBeFocused();

  await headline.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Metin", exact: true })).toBeFocused();
  // The words are selected when the box opens, so typing replaces them.
  await page.keyboard.type("Yazılım Mühendisi");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("group", { name: "Metin: Yazılım Mühendisi" })).toBeVisible();
});

test("VB-13 düzenleme durduktan sonra pano kendiliğinden kaydedilir", async ({ page }) => {
  const api = await mockBoardApi(page);
  await page.goto("/vision-board/board");

  await page.getByRole("group", { name: "Metin: Bilgisayar Mühendisi" }).focus();
  await page.keyboard.press("ArrowRight");
  // Words on a wide screen, a dot with the same words for a screen reader on a phone.
  await expect(page.getByText("Kaydedilmedi", { exact: true })).toBeAttached();

  await expect.poll(() => api.boardPuts.length, { timeout: 8_000 }).toBeGreaterThan(0);
  const saved = api.boardPuts.at(-1)!.items.find(
    (item) => item.kind === "text" && item.text === "Bilgisayar Mühendisi",
  );
  // Seeded at the canvas's centre, (1620 - 520) / 2 = 550, and one arrow step to the right.
  expect(saved?.x).toBe(554);
  await expect(page.getByText("Kaydedildi", { exact: true })).toBeAttached();
});

test("VB-14 Panelimde göster panoyu yayınlar ve yerini Kaydet'e bırakır", async ({ page }) => {
  const api = await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const publish = page.getByRole("button", { name: "Panelimde göster" });
  await publish.click();

  await expect.poll(() => api.boardPuts.at(-1)?.status).toBe("PUBLISHED");
  await expect(page.getByText("Panon panelde yayında")).toBeVisible();
  await expect(publish).toHaveCount(0);
  // Nothing left to save, so the page's one action waits.
  await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeDisabled();
});

test("VB-15 seçilen fotoğraf yüklenir ve panoya yerleşir", async ({ page }) => {
  const api = await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Görsel yükle" }).click();
  await (await chooser).setFiles({ name: "kampus.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });

  await expect(page.getByRole("group", { name: "Görsel", exact: true })).toBeVisible();
  expect(api.imageUploads).toEqual(["image/png"]);
  // The board is no longer untouched, so Puhu's welcome has done its job.
  await expect(page.getByText("Panon seni bekliyor.")).toBeHidden();
});

test("VB-16 karşılamadaki Şablonla başla şablon panelini açar", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Şablonla başla" }).click();

  await expect(page.getByRole("heading", { name: "Şablon", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Şablon", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("VB-17 dosya paylaşabilen cihazda Paylaş görseli sistem paylaşımına verir", async ({ page }) => {
  // The platform's share sheet cannot be opened by a test; this stands where it would.
  await page.addInitScript(() => {
    const shared: unknown[] = [];
    Object.assign(window, { __shared: shared });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data?: ShareData) => Boolean(data?.files?.length),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        shared.push(
          (data.files ?? []).map((file) => ({
            name: file.name,
            type: file.type,
            hasPicture: file.size > 100_000,
          })),
        );
      },
    });
  });
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Panonu paylaş" });
  await sheet.getByRole("button", { name: "Paylaş", exact: true }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
    .toEqual([[{ name: "hedef-panom.png", type: "image/png", hasPicture: true }]]);
  // Saving the file stays possible beside sharing it; copying belongs to the other layout.
  await expect(sheet.getByRole("button", { name: "İndir" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Görseli kopyala" })).toHaveCount(0);
});

test("VB-18 Görseli kopyala panoya PNG olarak yazar", async ({ page }) => {
  await page.addInitScript(() => {
    const copied: string[][] = [];
    Object.assign(window, { __copied: copied });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: async (items: ClipboardItem[]) => {
        copied.push(items.flatMap((item) => [...item.types]));
      },
    });
  });
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Panonu paylaş" });
  await sheet.getByRole("button", { name: "Görseli kopyala" }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __copied: string[][] }).__copied))
    .toEqual([["image/png"]]);
});

test("VB-19 panodaki fotoğraf indirilen görselde de vardır", async ({ page }) => {
  await mockBoardApi(page, { vision: visionWithBoard({ items: [boardPhoto] }) });
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const picture = page.getByRole("dialog").getByRole("img", { name: "Panonun görseli" });
  await expect.poll(() => naturalSize(picture)).toEqual({ width: 3584, height: 2504 });

  // The photo's middle is at (300, 350) on the board; the frame insets it by 86 units, and the
  // picture is drawn at 2×. The photo served here is solid magenta.
  expect(await pixelAt(picture, 772, 872)).toEqual([255, 0, 255]);
});

test("VB-20 açılmayan fotoğraf dışa aktarımı durdurur ve panoyu korur", async ({ page }) => {
  await mockBoardApi(page, {
    vision: visionWithBoard({ items: [boardPhoto] }),
    photo: "missing",
  });
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Bir fotoğraf şu an açılamıyor. Panon duruyor; biraz sonra yeniden deneyebilirsin.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "İndir", exact: true })).toBeDisabled();
});

test("VB-21 görsel paylaşılabilecek oda yoksa adım Topluluk'a yönlendirir", async ({ page }) => {
  // A question room takes no picture posts, so being in one is not enough.
  await mockBoardApi(page, { zones: [{ ...chatRoom, type: "QA" }] });
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Toplulukta paylaş" }).click();

  await expect(sheet.getByText("Henüz bir odada değilsin.")).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Topluluğa git" })).toHaveAttribute(
    "href",
    /\/(topluluk|community)$/,
  );
  await expect(sheet.getByLabel("Notun")).toHaveCount(0);
});

test("VB-22 sunucu gönderiyi reddederse nedeni pencerede kalır, not kaybolmaz", async ({ page }) => {
  const api = await mockBoardApi(page, {
    zones: [chatRoom],
    threadFailure: {
      status: 422,
      code: "FORUM_POST_REJECTED",
      message: "Bu odada şu an paylaşım yapılamıyor.",
    },
  });
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Toplulukta paylaş" }).click();
  await sheet.getByLabel("Notun").fill("Hedefim burada duruyor.");
  const post = sheet.getByRole("button", { name: "Paylaş", exact: true });
  await post.click();

  // The server's own words, not a guess at them.
  await expect(sheet.getByRole("alert")).toHaveText("Bu odada şu an paylaşım yapılamıyor.");
  await expect(sheet.getByLabel("Notun")).toHaveValue("Hedefim burada duruyor.");
  await expect(post).toBeEnabled();
  expect(api.threads).toEqual([]);
});

test("VB-23 tek uygun oda varsa seçili gelir", async ({ page }) => {
  await mockBoardApi(page, { zones: [chatRoom] });
  await page.goto("/vision-board/board");

  await page.getByRole("button", { name: "Paylaş", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Toplulukta paylaş" }).click();

  await expect(sheet.getByRole("button", { name: "Oda" })).toContainText("YKS sohbet");
  const post = sheet.getByRole("button", { name: "Paylaş", exact: true });
  await expect(post).toBeDisabled();
  await sheet.getByLabel("Notun").fill("Hedefim burada duruyor.");
  await expect(post).toBeEnabled();
});

test("VB-24 koyu temada duvar ve chrome döner, panonun tuvali dönmez", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "mentor-theme", value: "dark", url: baseURL! }]);
  await mockBoardApi(page);
  await page.goto("/vision-board/board");

  const stage = page.locator("[data-board-stage]");
  // The collage is the user's own picture: cork stays cork (DESIGN.md §2.5).
  await expect(stage).toHaveCSS("background-color", "rgb(216, 176, 131)");
  // The wall is `--color-surface-container` and the rail `--color-surface`, in their dark values.
  const wall = await stage.evaluate(
    (element) => getComputedStyle(element.closest(".h-dvh")!).backgroundColor,
  );
  expect(wall).toBe("rgb(36, 40, 51)");
  await expect(page.getByRole("navigation", { name: "Pano araçları" })).toHaveCSS(
    "background-color",
    "rgb(26, 29, 36)",
  );
});

test("VB-25 kayıtlı pano açıldığında geri alınacak bir şey yoktur", async ({ page }) => {
  await mockBoardApi(page, {
    vision: visionWithBoard({ status: "PUBLISHED", items: [boardPhoto] }),
  });
  await page.goto("/vision-board/board");

  const photo = page.getByRole("group", { name: "Görsel", exact: true });
  await expect(photo).toBeVisible();
  // Opening a board is not an edit. With the load on the undo stack, this one key put an empty
  // placeholder in the board's place and left it dirty for autosave to write.
  await expect(page.getByRole("button", { name: "Geri al" })).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+z");

  await expect(photo).toBeVisible();
  await expect(page.getByText("Kaydedilmedi", { exact: true })).toHaveCount(0);
});
