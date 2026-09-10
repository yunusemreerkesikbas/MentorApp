# Coach App Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the existing responsive `AppNav` on every human-coach route while preserving the current coach authorization and mentorship content.

**Architecture:** Keep the `(coach)` route group and its scoped server layout. Simplify `CoachShell` into the existing auth/role guard plus the same `AppNav` and `mentor-app-shell` composition used by `(app)`, without moving routes or duplicating navigation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, next-intl, Tailwind CSS, Playwright.

## Global Constraints

- Use `apps/web/src/components/app-nav.tsx` directly; do not copy or fork its sidebar/mobile chrome.
- Preserve the anonymous redirect, onboarding-independent coach role guard, notification drawer, and backend authorization boundaries.
- Use existing `@mentor/ui` and `DESIGN.md` tokens; add no hardcoded visual values.
- Keep all existing coach content and API behavior unchanged.
- Run only coach-navigation development tests, not workspace-wide suites.
- Append a timeline entry to `docs/features/mentorship.md`.

---

### Task 1: Reuse the responsive app navigation in the coach shell

**Files:**

- Modify: `apps/web/e2e/coach-home.spec.ts`
- Modify: `apps/web/src/app/[locale]/(coach)/coach-shell.tsx`
- Modify: `docs/features/mentorship.md`

**Interfaces:**

- Consumes: `AppNav(): JSX.Element`, `MOBILE_TAB_BAR_PADDING_CLASS: string`, and the global `mentor-app-shell` layout class.
- Preserves: `CoachShell({ children }: { children: ReactNode }): JSX.Element`.
- Produces: one role-aware responsive navigation implementation shared by all `(coach)` routes.

- [ ] **Step 1: Write the failing desktop navigation test**

Replace the existing `"koç kabuğu bildirim ziline ve kendi navigasyonuna sahip"` test with assertions that identify the shared `AppNav` and reject the old brand header:

```ts
test("koç kabuğu panelle aynı masaüstü sidebarını kullanır", async ({
  page,
}) => {
  await page.goto("/kocluk");

  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bildirimler", exact: false }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByText("Mentor", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Panele dön" })).toHaveCount(0);
});
```

- [ ] **Step 2: Write the failing mobile and nested-route tests**

Add project-specific tests so each viewport checks the chrome that is actually visible:

```ts
test("koç kabuğu mobilde panel üst ve alt navigasyonunu kullanır", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.goto("/kocluk");

  await expect(page.locator("header")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Ana menü" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
});

test("ortak sidebar koç profil alt rotasında da korunur", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/kocluk/profil");

  await expect(page.getByTestId("app-sidebar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Öğrencilerim" })).toBeVisible();
});
```

If the translated navigation aria-label differs, use the exact current Turkish value from
`apps/web/messages/tr.json`; do not weaken the assertion to an unlabeled locator.

- [ ] **Step 3: Run the focused browser spec and verify RED**

Build only the web app because Playwright starts the production server:

```bash
pnpm --filter @mentor/web build
pnpm --filter @mentor/web exec playwright test e2e/coach-home.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: the new sidebar/mobile assertions fail because `CoachShell` still renders its custom
header and no `data-testid="app-sidebar"` element.

- [ ] **Step 4: Replace the duplicated coach navigation**

In `coach-shell.tsx`, remove `IdCard`, `Settings`, `Users`, `UsersRound`, `LucideIcon`,
`NotificationBell`, the local `NAV` constant, and the custom `<header>`. Add:

```ts
import { AppNav } from "@/components/app-nav";
import { MOBILE_TAB_BAR_PADDING_CLASS } from "@/lib/app-shell";
```

Keep both existing guard branches unchanged. Replace only the authenticated coach return value:

```tsx
return (
  <NotificationDrawerShell>
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <AppNav />
      <div
        className={`mentor-app-shell min-h-screen ${MOBILE_TAB_BAR_PADDING_CLASS} lg:pb-0`}
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:py-10">
          {children}
        </div>
      </div>
    </div>
  </NotificationDrawerShell>
);
```

Do not add a second role filter. `AppNav.visibleTo` already hides student-only destinations and
exposes `/students` to `COACH`.

- [ ] **Step 5: Run the focused browser spec and verify GREEN**

```bash
pnpm --filter @mentor/web build
pnpm --filter @mentor/web exec playwright test e2e/coach-home.spec.ts \
  --project=desktop-chromium --project=mobile-chromium
```

Expected: all tests in `coach-home.spec.ts` pass in both named projects; the coach home and nested
profile route render the shared responsive chrome.

- [ ] **Step 6: Append the mentorship feature timeline**

Add the newest entry under `## Geliştirmeler (timeline)` in `docs/features/mentorship.md`:

```md
### 2026-09-10 — Koçluk kabuğu ortak AppNav kullanıyor

`/kocluk`, koç profili ve öğrenci detayları artık panelle aynı `AppNav` kabuğunu kullanır:
masaüstünde açılıp daralabilen sol sidebar, mobilde ortak üst başlık ve alt tab bar görünür.
`(coach)` route grubu ile COACH guard'ı değişmedi; yalnız navigasyon kopyası kaldırıldı. Kullanım:
tüm koç rotalarında chrome otomatik gelir. Gotcha: koç görünürlüğü `AppNav.visibleTo` üzerinden
role-aware filtrelenir; koç kabuğunda ikinci bir menü veya rol filtresi eklenmemelidir. İlgili:
`coach-shell.tsx`, `app-nav.tsx`, `e2e/coach-home.spec.ts`.
```

- [ ] **Step 7: Run targeted static checks**

```bash
pnpm --filter @mentor/web exec eslint \
  'src/app/[locale]/(coach)/coach-shell.tsx' \
  e2e/coach-home.spec.ts
pnpm exec prettier --check \
  'apps/web/src/app/[locale]/(coach)/coach-shell.tsx' \
  apps/web/e2e/coach-home.spec.ts \
  docs/features/mentorship.md
```

Expected: both commands exit 0. Do not run workspace-wide lint, typecheck, build, or test.

- [ ] **Step 8: Commit and push the completed implementation**

```bash
git add \
  'apps/web/src/app/[locale]/(coach)/coach-shell.tsx' \
  apps/web/e2e/coach-home.spec.ts \
  docs/features/mentorship.md \
  docs/superpowers/plans/2026-09-10-coach-app-nav.md
git commit -m "feat: reuse app navigation across coach routes"
git push -u origin cursor/coach-app-nav-11cc
```

Expected: the branch is clean and the remote contains the implementation commit.
