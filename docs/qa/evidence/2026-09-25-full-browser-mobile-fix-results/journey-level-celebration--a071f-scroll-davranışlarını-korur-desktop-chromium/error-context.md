# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey-level-celebration.spec.ts >> tanışmayı bir kez gösterir; hata, odak ve scroll davranışlarını korur
- Location: e2e\journey-level-celebration.spec.ts:71:5

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByRole('dialog', { name: 'Seviye 4 · Döngü' }).getByRole('button', { name: 'Devam et' })
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Seviye 4 · Döngü' }).getByRole('button', { name: 'Devam et' })
    13 × locator resolved to <button data-journey-celebration-cta="true" class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--play-radius)] outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--play-track)] disabled:text-[var(--color-secondary)] disabled:shad…>Devam et</button>
       - unexpected value "inactive"

```

```yaml
- button "Devam et"
```

# Test source

```ts
  1   | import { expect, test, type Page, type Route } from "@playwright/test";
  2   | import type {
  3   |   AuthUser,
  4   |   JourneyLevelCelebrationView,
  5   | } from "@mentor/types";
  6   | 
  7   | const user: AuthUser = {
  8   |   id: "33333333-3333-4333-8333-333333333333",
  9   |   email: "journey@test.local",
  10  |   displayName: "Gece Yolcusu",
  11  |   username: "gece_yolcusu",
  12  |   avatarUrl: null,
  13  |   bio: null,
  14  |   website: null,
  15  |   roles: ["STUDENT"],
  16  |   organizationId: null,
  17  |   examType: "KPSS",
  18  |   examVariant: null,
  19  |   examDate: "2027-07-25",
  20  |   dailyFocusGoalMinutes: null,
  21  |   emailVerified: true,
  22  |   createdAt: "2026-01-01T00:00:00.000Z",
  23  | };
  24  | 
  25  | const introduction: JourneyLevelCelebrationView = {
  26  |   id: "11111111-1111-4111-8111-111111111111",
  27  |   kind: "INTRODUCTION",
  28  |   tier: 4,
  29  |   key: "cycle",
  30  |   chapter: "harmony",
  31  |   unlockedAt: "2026-08-22T10:00:00.000Z",
  32  | };
  33  | 
  34  | const levelUp: JourneyLevelCelebrationView = {
  35  |   id: "22222222-2222-4222-8222-222222222222",
  36  |   kind: "LEVEL_UP",
  37  |   tier: 5,
  38  |   key: "rhythm",
  39  |   chapter: "harmony",
  40  |   unlockedAt: "2026-08-22T11:00:00.000Z",
  41  | };
  42  | 
  43  | test.beforeEach(async ({ page }) => {
  44  |   await page.addInitScript(() => {
  45  |     window.localStorage.setItem("mentor.analytics-consent.v1", "rejected");
  46  | 
  47  |     class TestEventSource {
  48  |       static readonly CLOSED = 2;
  49  |       readonly readyState = 1;
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
> 84  |   await expect(continueButton).toBeFocused();
      |                                ^ Error: expect(locator).toBeFocused() failed
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
  150 |   ).toBeFocused();
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
```