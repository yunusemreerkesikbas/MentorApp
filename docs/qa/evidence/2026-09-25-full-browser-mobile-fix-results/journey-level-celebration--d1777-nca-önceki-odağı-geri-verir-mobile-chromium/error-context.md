# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey-level-celebration.spec.ts >> canlı SSE sinyali seviyeyi açar ve kapanınca önceki odağı geri verir
- Location: e2e\journey-level-celebration.spec.ts:115:5

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByRole('dialog', { name: 'Seviye 5 · Nabız' }).getByRole('button', { name: 'Devam et' })
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Seviye 5 · Nabız' }).getByRole('button', { name: 'Devam et' })
    12 × locator resolved to <button data-journey-celebration-cta="true" class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--play-radius)] outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--play-track)] disabled:text-[var(--color-secondary)] disabled:shad…>Devam et</button>
       - unexpected value "inactive"

```

```yaml
- button "Devam et"
```

# Test source

```ts
  50  |       onmessage: ((event: MessageEvent) => void) | null = null;
  51  |       onerror: (() => void) | null = null;
  52  | 
  53  |       constructor() {
  54  |         const testWindow = window as typeof window & {
  55  |           __journeyEventSources?: TestEventSource[];
  56  |         };
  57  |         testWindow.__journeyEventSources ??= [];
  58  |         testWindow.__journeyEventSources.push(this);
  59  |       }
  60  | 
  61  |       close() {}
  62  |     }
  63  | 
  64  |     Object.defineProperty(window, "EventSource", {
  65  |       configurable: true,
  66  |       value: TestEventSource,
  67  |     });
  68  |   });
  69  | });
  70  | 
  71  | test("tanışmayı bir kez gösterir; hata, odak ve scroll davranışlarını korur", async ({
  72  |   page,
  73  | }) => {
  74  |   const api = await mockJourneyCelebrationApi(page, introduction);
  75  |   await page.goto("/profil");
  76  | 
  77  |   const dialog = page.getByRole("dialog", { name: "Seviye 4 · Döngü" });
  78  |   const continueButton = dialog.getByRole("button", {
  79  |     name: "Devam et",
  80  |   });
  81  |   const closeButton = dialog.getByRole("button", { name: "Kapat" });
  82  | 
  83  |   await expect(dialog).toBeVisible();
  84  |   await expect(continueButton).toBeFocused();
  85  |   await expect
  86  |     .poll(() => page.evaluate(() => document.body.style.overflow))
  87  |     .toBe("hidden");
  88  | 
  89  |   await page.keyboard.press("Tab");
  90  |   await expect(closeButton).toBeFocused();
  91  |   await page.keyboard.press("Shift+Tab");
  92  |   await expect(continueButton).toBeFocused();
  93  | 
  94  |   api.failAcknowledgement = true;
  95  |   await continueButton.click();
  96  |   await expect(dialog).toBeVisible();
  97  |   await expect(
  98  |     dialog.getByText(
  99  |       "Kutlamayı şimdilik kapatamadık. Tekrar deneyebilirsin.",
  100 |     ),
  101 |   ).toBeVisible();
  102 | 
  103 |   api.failAcknowledgement = false;
  104 |   await continueButton.click();
  105 |   await expect(dialog).toHaveCount(0);
  106 |   await expect
  107 |     .poll(() => page.evaluate(() => document.body.style.overflow))
  108 |     .toBe("");
  109 | 
  110 |   await page.reload();
  111 |   await expect(dialog).toHaveCount(0);
  112 |   expect(api.acknowledgementCalls).toBe(2);
  113 | });
  114 | 
  115 | test("canlı SSE sinyali seviyeyi açar ve kapanınca önceki odağı geri verir", async ({
  116 |   page,
  117 | }) => {
  118 |   const api = await mockJourneyCelebrationApi(page, null);
  119 |   await page.goto("/profil");
  120 |   await expect(page).toHaveURL(/\/ayarlar$/);
  121 |   await page.waitForLoadState("networkidle");
  122 | 
  123 |   const previousFocus = page.getByRole("button", { name: /temaya geç/ });
  124 |   await expect(previousFocus).toBeVisible();
  125 |   await previousFocus.focus();
  126 |   await expect(previousFocus).toBeFocused();
  127 | 
  128 |   api.celebration = levelUp;
  129 |   await page.evaluate(() => {
  130 |     const testWindow = window as typeof window & {
  131 |       __journeyEventSources?: Array<{
  132 |         onmessage: ((event: MessageEvent) => void) | null;
  133 |       }>;
  134 |     };
  135 |     testWindow.__journeyEventSources?.forEach((source) =>
  136 |       source.onmessage?.(
  137 |         new MessageEvent("message", {
  138 |           data: JSON.stringify({ event: "journey_level_unlocked" }),
  139 |         }),
  140 |       ),
  141 |     );
  142 |   });
  143 | 
  144 |   const dialog = page.getByRole("dialog", {
  145 |     name: "Seviye 5 · Nabız",
  146 |   });
  147 |   await expect(dialog).toBeVisible();
  148 |   await expect(
  149 |     dialog.getByRole("button", { name: "Devam et" }),
> 150 |   ).toBeFocused();
      |     ^ Error: expect(locator).toBeFocused() failed
  151 |   await expect(page.getByRole("dialog")).toHaveCount(1);
  152 | 
  153 |   await dialog.getByRole("button", { name: "Devam et" }).click();
  154 |   await expect(dialog).toHaveCount(0);
  155 |   await expect(previousFocus).toBeFocused();
  156 | });
  157 | 
  158 | test("kaçırılan canlı sinyali sonraki açılışta kalıcı kaynaktan toparlar", async ({
  159 |   page,
  160 | }) => {
  161 |   await mockJourneyCelebrationApi(page, levelUp);
  162 |   await page.goto("/profil");
  163 | 
  164 |   await expect(
  165 |     page.getByRole("dialog", { name: "Seviye 5 · Nabız" }),
  166 |   ).toBeVisible();
  167 | });
  168 | 
  169 | interface JourneyCelebrationApi {
  170 |   celebration: JourneyLevelCelebrationView | null;
  171 |   failAcknowledgement: boolean;
  172 |   readonly acknowledgementCalls: number;
  173 | }
  174 | 
  175 | async function mockJourneyCelebrationApi(
  176 |   page: Page,
  177 |   initialCelebration: JourneyLevelCelebrationView | null,
  178 | ): Promise<JourneyCelebrationApi> {
  179 |   let celebration = initialCelebration;
  180 |   let failAcknowledgement = false;
  181 |   let acknowledgementCalls = 0;
  182 | 
  183 |   const state: JourneyCelebrationApi = {
  184 |     get celebration() {
  185 |       return celebration;
  186 |     },
  187 |     set celebration(value) {
  188 |       celebration = value;
  189 |     },
  190 |     get failAcknowledgement() {
  191 |       return failAcknowledgement;
  192 |     },
  193 |     set failAcknowledgement(value) {
  194 |       failAcknowledgement = value;
  195 |     },
  196 |     get acknowledgementCalls() {
  197 |       return acknowledgementCalls;
  198 |     },
  199 |   };
  200 | 
  201 |   await page.route("http://localhost:3001/v1/**", async (route) => {
  202 |     const request = route.request();
  203 |     const url = new URL(request.url());
  204 |     const path = url.pathname + url.search;
  205 |     const method = request.method();
  206 | 
  207 |     if (method === "OPTIONS") return json(route, null, 204);
  208 |     if (method === "POST" && path === "/v1/auth/refresh") {
  209 |       return json(route, { accessToken: "test-token", expiresIn: 3600, user });
  210 |     }
  211 |     if (method === "GET" && path === "/v1/users/me") return json(route, user);
  212 |     if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
  213 |       return json(route, {
  214 |         enabled: false,
  215 |         linked: false,
  216 |         providerEmail: null,
  217 |         canLink: false,
  218 |       });
  219 |     }
  220 |     if (method === "GET" && path.startsWith("/v1/notifications?")) {
  221 |       return json(route, {
  222 |         items: [],
  223 |         total: 0,
  224 |         page: 1,
  225 |         pageSize: 20,
  226 |         unreadCount: 0,
  227 |       });
  228 |     }
  229 |     if (method === "POST" && path === "/v1/notifications/stream-token") {
  230 |       return json(route, { token: "test-stream" });
  231 |     }
  232 |     if (method === "GET" && path === "/v1/notifications/preferences") {
  233 |       return json(route, { emailEnabled: true, pushEnabled: true });
  234 |     }
  235 |     if (method === "GET" && path === "/v1/community/achievements/unseen") {
  236 |       return json(route, { celebrations: [] });
  237 |     }
  238 |     if (
  239 |       method === "GET" &&
  240 |       path === "/v1/community/journey-levels/unseen"
  241 |     ) {
  242 |       return json(route, { celebrations: celebration ? [celebration] : [] });
  243 |     }
  244 |     if (
  245 |       method === "POST" &&
  246 |       path === "/v1/community/journey-levels/celebrated"
  247 |     ) {
  248 |       acknowledgementCalls += 1;
  249 |       if (failAcknowledgement) {
  250 |         return json(route, { code: "TEMPORARY_FAILURE" }, 500);
```