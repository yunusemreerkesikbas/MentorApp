# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notebooks.spec.ts >> koleksiyondan ders defteri oluşturulur, serbest editör açılır ve defter silinir
- Location: e2e\notebooks.spec.ts:239:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/defterlerim\/88888888-8888-4888-8888-888888888888$/
Received string:  "http://localhost:3100/defterlerim"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × unexpected value "http://localhost:3100/defterlerim"

```

```yaml
- alert
- banner:
  - link "Profiline git":
    - /url: /topluluk/uye/defter_test
  - paragraph: Günaydın
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
- main:
  - heading "Defterlerim" [level=1]
  - paragraph: Yanlışlarını takip et veya kendine ders ders çalışma alanları aç.
  - button "Yeni defter"
  - article:
    - link "Yanlış Defterim Yanlış Defterim 2 sayfa Bugün 3 tekrar":
      - /url: /yanlis-defteri
      - paragraph: Yanlış Defterim
      - heading "Yanlış Defterim" [level=2]
      - paragraph: 2 sayfa
      - paragraph: Bugün 3 tekrar
```

# Test source

```ts
  154 |     if (method === "GET" && path === "/v1/coaching/notebooks") {
  155 |       state.listCalls += 1;
  156 |       const requestedPage = Number(url.searchParams.get("page") ?? 1);
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
> 254 |   await expect(page).toHaveURL(new RegExp(`/defterlerim/${CUSTOM_ID}$`));
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  255 |   await expect(page.getByText("Matematik Notlarım").first()).toBeVisible();
  256 |   await page.getByRole("button", { name: "Defteri aç" }).click();
  257 |   const showTools = page.getByRole("button", { name: "Araçları göster" });
  258 |   if (await showTools.isVisible()) await showTools.click();
  259 |   await expect(page.getByRole("button", { name: "Sticker" })).toBeVisible();
  260 |   await expect(page.getByRole("button", { name: "Not" })).toBeVisible();
  261 |   await expect(
  262 |     page.getByRole("button", { name: "Ekle", exact: true }),
  263 |   ).toHaveCount(0);
  264 |   await expect(
  265 |     page.getByRole("button", { name: "Ara", exact: true }),
  266 |   ).toHaveCount(0);
  267 |   await page.getByRole("button", { name: "Not" }).click();
  268 |   await page.getByRole("textbox").fill("Autosave notu");
  269 |   await page.getByRole("textbox").press("Escape");
  270 |   await expect.poll(() => state.pagePuts).toBeGreaterThan(0);
  271 | 
  272 |   await page.goto("/defterlerim");
  273 |   // Card actions are revealed by card hover (or keyboard focus) wherever hover exists; touch
  274 |   // devices keep them on permanently so they stay reachable. Playwright's own auto-hover aims at
  275 |   // the button, which is still hidden at that point, so the CARD has to be hovered first.
  276 |   await page.getByRole("heading", { name: "Matematik Notlarım" }).hover();
  277 |   await page
  278 |     .getByRole("button", { name: "Matematik Notlarım defterini sil" })
  279 |     .click();
  280 |   await page.getByRole("button", { name: "Defteri sil" }).click();
  281 |   await expect(
  282 |     page.getByRole("heading", { name: "Matematik Notlarım" }),
  283 |   ).toHaveCount(0);
  284 | });
  285 | 
  286 | test("daha fazla hatası yeniden denenir ve mutation sonrası sayfalama server ile senkronlanır", async ({
  287 |   page,
  288 | }) => {
  289 |   const initialCustoms = Array.from({ length: 13 }, (_, index): NotebookDto => ({
  290 |     id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  291 |     kind: "CUSTOM",
  292 |     title: `Defter ${index + 1}`,
  293 |     examId: null,
  294 |     subjectRef: null,
  295 |     subjectName: null,
  296 |     cover: { color: "navy", material: "cloth" },
  297 |     pageCount: 0,
  298 |     dueCount: 0,
  299 |     createdAt: "2026-08-25T10:00:00.000Z",
  300 |     updatedAt: new Date(Date.UTC(2026, 7, 25, 10, index)).toISOString(),
  301 |   }));
  302 |   const state = await mockApi(page, { initialCustoms, failPageTwoOnce: true });
  303 |   await page.goto("/defterlerim");
  304 |   await expect(page.locator("article")).toHaveCount(12);
  305 | 
  306 |   await page.getByRole("button", { name: "Daha fazla" }).click();
  307 |   await expect(
  308 |     page.getByRole("alert").filter({ hasText: "devamı yüklenemedi" }),
  309 |   ).toBeVisible();
  310 |   await page.getByRole("button", { name: "Yeniden dene" }).click();
  311 |   await expect(page.locator("article")).toHaveCount(14);
  312 | 
  313 |   const callsBeforeCreate = state.listCalls;
  314 |   await page.getByRole("button", { name: "Yeni defter" }).click();
  315 |   await expect(page.getByLabel("Defter adı")).toBeFocused();
  316 |   await page.getByLabel("Defter adı").fill("Yeni Eklenen");
  317 |   await page.getByRole("button", { name: "Kaydet" }).click();
  318 | 
  319 |   await expect.poll(() => state.listCalls).toBeGreaterThan(callsBeforeCreate);
  320 |   await expect(page.locator("article")).toHaveCount(12);
  321 |   await expect(page.getByRole("heading", { name: "Yeni Eklenen" })).toBeVisible();
  322 |   const createButton = page.getByRole("button", { name: "Yeni defter" });
  323 |   expect((await createButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  324 | });
  325 | 
  326 | test("silme başarılıyken liste yenileme tekrarı ikinci DELETE göndermez", async ({ page }) => {
  327 |   const custom: NotebookDto = {
  328 |     id: CUSTOM_ID,
  329 |     kind: "CUSTOM",
  330 |     title: "Silinecek Defter",
  331 |     examId: null,
  332 |     subjectRef: null,
  333 |     subjectName: null,
  334 |     cover: { color: "navy", material: "cloth" },
  335 |     pageCount: 0,
  336 |     dueCount: 0,
  337 |     createdAt: "2026-08-25T10:00:00.000Z",
  338 |     updatedAt: "2026-08-25T10:00:00.000Z",
  339 |   };
  340 |   const state = await mockApi(page, {
  341 |     initialCustoms: [custom],
  342 |     failFirstPageAfterDeleteOnce: true,
  343 |   });
  344 |   await page.goto("/defterlerim");
  345 | 
  346 |   await page.getByRole("heading", { name: "Silinecek Defter" }).hover();
  347 |   await page.getByRole("button", { name: "Silinecek Defter defterini sil" }).click();
  348 |   await page.getByRole("button", { name: "Defteri sil" }).click();
  349 | 
  350 |   const syncAlert = page.getByRole("alert").filter({ hasText: "Defter silindi" });
  351 |   await expect(syncAlert).toBeVisible();
  352 |   await expect(page.getByRole("heading", { name: "Silinecek Defter" })).toHaveCount(0);
  353 | 
  354 |   const callsAfterFailedSync = state.listCalls;
```