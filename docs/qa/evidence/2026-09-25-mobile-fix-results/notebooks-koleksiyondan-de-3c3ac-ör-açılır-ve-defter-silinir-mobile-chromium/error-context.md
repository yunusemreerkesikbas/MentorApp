# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notebooks.spec.ts >> koleksiyondan ders defteri oluşturulur, serbest editör açılır ve defter silinir
- Location: e2e\notebooks.spec.ts:239:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Sticker' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Sticker' })

```

```yaml
- alert
- banner:
  - link "Profiline git":
    - /url: /topluluk/uye/defter_test
  - paragraph: İyi geceler
  - paragraph: Defter Test
  - button "Koyu temaya geç"
  - button "Bildirimler"
- navigation "Ana menü":
  - link "Anasayfa":
    - /url: /panel
  - link "Plan":
    - /url: /plan
  - link "Koç":
    - /url: /koc
  - link "Analiz":
    - /url: /analiz
  - link "Blog":
    - /url: /blog
- navigation "Defter araçları":
  - button "Araçları göster"
- button "Geri al" [disabled]
- button "Seçileni sil" [disabled]
- button "Kaydet" [disabled]
- button "Önceki"
- text: Sayfa 1
- button "Sonraki"
```

# Test source

```ts
  157 |       if (requestedPage === 1 && deleted && failFirstPageAfterDelete) {
  158 |         failFirstPageAfterDelete = false;
  159 |         return json(route, { code: "TEMPORARY_ERROR", message: "temporary" }, 503);
  160 |       }
  161 |       if (requestedPage === 2 && failPageTwo) {
  162 |         failPageTwo = false;
  163 |         return json(route, { code: "TEMPORARY_ERROR", message: "temporary" }, 503);
  164 |       }
  165 |       const all = [systemNotebook, ...customs];
  166 |       const pageSize = Number(url.searchParams.get("pageSize") ?? 12);
  167 |       const items = all.slice((requestedPage - 1) * pageSize, requestedPage * pageSize);
  168 |       return json(route, {
  169 |         items,
  170 |         total: all.length,
  171 |         page: requestedPage,
  172 |         pageSize,
  173 |       });
  174 |     }
  175 |     if (method === "POST" && path === "/v1/coaching/notebooks") {
  176 |       const body = request.postDataJSON() as {
  177 |         title: string;
  178 |         examId: string | null;
  179 |         subjectRef: string | null;
  180 |         cover: NotebookDto["cover"];
  181 |       };
  182 |       const custom: NotebookDto = {
  183 |         id: CUSTOM_ID,
  184 |         kind: "CUSTOM",
  185 |         title: body.title,
  186 |         examId: body.examId,
  187 |         subjectRef: body.subjectRef,
  188 |         subjectName: "Matematik",
  189 |         cover: body.cover,
  190 |         pageCount: 0,
  191 |         dueCount: 0,
  192 |         createdAt: "2026-08-25T10:00:00.000Z",
  193 |         updatedAt: "2026-08-25T10:00:00.000Z",
  194 |       };
  195 |       customs = [custom, ...customs.filter((item) => item.id !== CUSTOM_ID)];
  196 |       return json(route, custom, 201);
  197 |     }
  198 |     if (method === "GET" && path === `/v1/coaching/notebooks/${CUSTOM_ID}`) {
  199 |       return json(route, customs.find((item) => item.id === CUSTOM_ID) ?? null);
  200 |     }
  201 |     if (method === "PATCH" && path === `/v1/coaching/notebooks/${CUSTOM_ID}`) {
  202 |       const current = customs.find((item) => item.id === CUSTOM_ID);
  203 |       const body = request.postDataJSON() as Partial<NotebookDto>;
  204 |       const updated = current ? { ...current, ...body } : null;
  205 |       if (updated) customs = [updated, ...customs.filter((item) => item.id !== CUSTOM_ID)];
  206 |       return json(route, updated);
  207 |     }
  208 |     if (method === "DELETE" && path === `/v1/coaching/notebooks/${CUSTOM_ID}`) {
  209 |       state.deleteCalls += 1;
  210 |       deleted = true;
  211 |       customs = customs.filter((item) => item.id !== CUSTOM_ID);
  212 |       return json(route, null, 204);
  213 |     }
  214 |     const pageMatch = path.match(
  215 |       new RegExp(`/v1/coaching/notebooks/${CUSTOM_ID}/pages/(\\d+)$`),
  216 |     );
  217 |     if (method === "GET" && pageMatch) {
  218 |       const pageIndex = Number(pageMatch[1]);
  219 |       const result: NotebookPageDto = {
  220 |         pageIndex,
  221 |         doc: { version: 1, paper: "ruled", items: [], ink: [] },
  222 |         entries: [],
  223 |       };
  224 |       return json(route, result);
  225 |     }
  226 |     if (method === "PUT" && pageMatch) {
  227 |       state.pagePuts += 1;
  228 |       return json(route, {
  229 |         pageIndex: Number(pageMatch[1]),
  230 |         doc: (request.postDataJSON() as { doc: unknown }).doc,
  231 |         entries: [],
  232 |       });
  233 |     }
  234 |     return json(route, null, 204);
  235 |   });
  236 |   return state;
  237 | }
  238 | 
  239 | test("koleksiyondan ders defteri oluşturulur, serbest editör açılır ve defter silinir", async ({
  240 |   page,
  241 | }) => {
  242 |   const state = await mockApi(page);
  243 |   await page.goto("/defterlerim");
  244 | 
  245 |   await expect(page.locator("article h2").first()).toHaveText(
  246 |     "Yanlış Defterim",
  247 |   );
  248 |   await page.getByRole("button", { name: "Yeni defter" }).click();
  249 |   await page.getByLabel("Defter adı").fill("Matematik Notlarım");
  250 |   await page.getByLabel("Ders (isteğe bağlı)").click();
  251 |   await page.getByRole("option", { name: "Matematik" }).click();
  252 |   await page.getByRole("button", { name: "Kaydet" }).click();
  253 | 
  254 |   await expect(page).toHaveURL(new RegExp(`/defterlerim/${CUSTOM_ID}$`));
  255 |   await expect(page.getByText("Matematik Notlarım").first()).toBeVisible();
  256 |   await page.getByRole("button", { name: "Defteri aç" }).click();
> 257 |   await expect(page.getByRole("button", { name: "Sticker" })).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  258 |   await expect(page.getByRole("button", { name: "Not" })).toBeVisible();
  259 |   await expect(
  260 |     page.getByRole("button", { name: "Ekle", exact: true }),
  261 |   ).toHaveCount(0);
  262 |   await expect(
  263 |     page.getByRole("button", { name: "Ara", exact: true }),
  264 |   ).toHaveCount(0);
  265 |   await page.getByRole("button", { name: "Not" }).click();
  266 |   await page.getByRole("textbox").fill("Autosave notu");
  267 |   await page.getByRole("textbox").press("Escape");
  268 |   await expect.poll(() => state.pagePuts).toBeGreaterThan(0);
  269 | 
  270 |   await page.goto("/defterlerim");
  271 |   // Card actions are revealed by card hover (or keyboard focus) wherever hover exists; touch
  272 |   // devices keep them on permanently so they stay reachable. Playwright's own auto-hover aims at
  273 |   // the button, which is still hidden at that point, so the CARD has to be hovered first.
  274 |   await page.getByRole("heading", { name: "Matematik Notlarım" }).hover();
  275 |   await page
  276 |     .getByRole("button", { name: "Matematik Notlarım defterini sil" })
  277 |     .click();
  278 |   await page.getByRole("button", { name: "Defteri sil" }).click();
  279 |   await expect(
  280 |     page.getByRole("heading", { name: "Matematik Notlarım" }),
  281 |   ).toHaveCount(0);
  282 | });
  283 | 
  284 | test("daha fazla hatası yeniden denenir ve mutation sonrası sayfalama server ile senkronlanır", async ({
  285 |   page,
  286 | }) => {
  287 |   const initialCustoms = Array.from({ length: 13 }, (_, index): NotebookDto => ({
  288 |     id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  289 |     kind: "CUSTOM",
  290 |     title: `Defter ${index + 1}`,
  291 |     examId: null,
  292 |     subjectRef: null,
  293 |     subjectName: null,
  294 |     cover: { color: "navy", material: "cloth" },
  295 |     pageCount: 0,
  296 |     dueCount: 0,
  297 |     createdAt: "2026-08-25T10:00:00.000Z",
  298 |     updatedAt: new Date(Date.UTC(2026, 7, 25, 10, index)).toISOString(),
  299 |   }));
  300 |   const state = await mockApi(page, { initialCustoms, failPageTwoOnce: true });
  301 |   await page.goto("/defterlerim");
  302 |   await expect(page.locator("article")).toHaveCount(12);
  303 | 
  304 |   await page.getByRole("button", { name: "Daha fazla" }).click();
  305 |   await expect(
  306 |     page.getByRole("alert").filter({ hasText: "devamı yüklenemedi" }),
  307 |   ).toBeVisible();
  308 |   await page.getByRole("button", { name: "Yeniden dene" }).click();
  309 |   await expect(page.locator("article")).toHaveCount(14);
  310 | 
  311 |   const callsBeforeCreate = state.listCalls;
  312 |   await page.getByRole("button", { name: "Yeni defter" }).click();
  313 |   await expect(page.getByLabel("Defter adı")).toBeFocused();
  314 |   await page.getByLabel("Defter adı").fill("Yeni Eklenen");
  315 |   await page.getByRole("button", { name: "Kaydet" }).click();
  316 | 
  317 |   await expect.poll(() => state.listCalls).toBeGreaterThan(callsBeforeCreate);
  318 |   await expect(page.locator("article")).toHaveCount(12);
  319 |   await expect(page.getByRole("heading", { name: "Yeni Eklenen" })).toBeVisible();
  320 |   const createButton = page.getByRole("button", { name: "Yeni defter" });
  321 |   expect((await createButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  322 | });
  323 | 
  324 | test("silme başarılıyken liste yenileme tekrarı ikinci DELETE göndermez", async ({ page }) => {
  325 |   const custom: NotebookDto = {
  326 |     id: CUSTOM_ID,
  327 |     kind: "CUSTOM",
  328 |     title: "Silinecek Defter",
  329 |     examId: null,
  330 |     subjectRef: null,
  331 |     subjectName: null,
  332 |     cover: { color: "navy", material: "cloth" },
  333 |     pageCount: 0,
  334 |     dueCount: 0,
  335 |     createdAt: "2026-08-25T10:00:00.000Z",
  336 |     updatedAt: "2026-08-25T10:00:00.000Z",
  337 |   };
  338 |   const state = await mockApi(page, {
  339 |     initialCustoms: [custom],
  340 |     failFirstPageAfterDeleteOnce: true,
  341 |   });
  342 |   await page.goto("/defterlerim");
  343 | 
  344 |   await page.getByRole("heading", { name: "Silinecek Defter" }).hover();
  345 |   await page.getByRole("button", { name: "Silinecek Defter defterini sil" }).click();
  346 |   await page.getByRole("button", { name: "Defteri sil" }).click();
  347 | 
  348 |   const syncAlert = page.getByRole("alert").filter({ hasText: "Defter silindi" });
  349 |   await expect(syncAlert).toBeVisible();
  350 |   await expect(page.getByRole("heading", { name: "Silinecek Defter" })).toHaveCount(0);
  351 | 
  352 |   const callsAfterFailedSync = state.listCalls;
  353 |   const retryButton = syncAlert.getByRole("button", { name: "Yeniden dene" });
  354 |   await retryButton.focus();
  355 |   await expect(retryButton).toBeFocused();
  356 |   await retryButton.press("Enter");
  357 |   await expect.poll(() => state.listCalls).toBeGreaterThan(callsAfterFailedSync);
```