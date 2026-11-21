# SEO sayfaları · "Landing'in odası" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the six public SEO pages their landing scene in the hero and a shared paper kit below, with the hero copy in the energetic Puhu voice, and leave the SEO text and the demo behaviour as they are.

**Architecture:** A shared server-rendered shell (`SeoLpShell`) owns the nav, theme wrapper, JSON-LD, FAQ and footer. A paper kit (`seo-paper.tsx` + `seo-paper.css`) renders notes, post-its, notebook tables, tag links and the scene frame. Each page passes only its hero scene, its demo and its copy. Flutter reuses the landing's `usePaperFlutter` through one small client root. The demos (`PublicPomodoroWidget`, `PlanDemoWidget`, `NotebookDemoWidget`) keep their logic and get only new markup and classes.

**Tech Stack:**
- Next.js 16 App Router (RSC), React 19, next-intl, Tailwind v4 + plain CSS files (the landing pattern).
- Vitest (node) for message and metadata contracts; Playwright (`mobile-*` 375×812, `desktop-*` 1280×800) for pages.

**Spec:** `docs/superpowers/specs/2026-11-21-seo-lp-landing-rooms-design.md`. Visual reference: canvas https://claude.ai/artifact/AynK6ZbCAVVQWzRCdGQnYy. Its `project/kit.css` holds the kit values: colors, radii, tilts, tape colors, notebook lines.

## Global Constraints

- **Branch:** a new branch cut from `feat/sprint-7-pilot-waitlist-qa`. Do not stash or commit the owner's uncommitted mobile work yourself.
- **SEO text stays unchanged:**
  - Unchanged keys: `h1`, `proof`, `answer_first` / `definition` / `what_body`, every FAQ `q*` / `a*`, compare rows, sample rows, step texts, closing texts, CTA texts and link texts.
  - The route, canonical, robots (EN noindex), JSON-LD, `llms.txt` and sitemap also stay as they are.
- **Anchors kept:** `#nasil`, `#ornek` / `#ornek-tyt`, `#veli`, `#nasil-calisir`, `#ozellikler`, `#sss`, `#timer`.
- **Copy:** only `subhead` values change (they become the vitrin line), plus the new keys listed in Task 1.
  - Voice: voice.md "Landing: enerjik Puhu".
  - TR uses `yapay zekâ`, never `AI`.
  - No access-gate or KVKK details in the hero.
  - No pencere/ışık metaphor in new words.
- **CTAs:** `SeoSignupCta` keeps its `source` and `location` values. Every location in use today stays in use: `hero`, `demo`, `table`, `timer_done`, `closing`, `parent`, `how`, `features`.
- **Demos keep their behaviour:**
  - Plan demo: three groups and the 7-day preview.
  - Notebook demo: one card, no "1 / 3".
  - Pomodoro widget: unchanged.
- **Theme:** stays under `landing-city-theme landing-day` + `.landing-paper`. No night palette.
- **Motion:**
  - CSS + `usePaperFlutter` only. No framer-motion.
  - No first-render branch on `useReducedMotion()`.
  - With `prefers-reduced-motion: reduce`, nothing flutters, bobs or blinks.
- **Perf:** H1 and vitrin line paint without waiting on any image. Scene art uses AVIF+WebP (`SceneImg`) and the hero scene loads eagerly (`fetchPriority="high"`). Mobile LCP ≤ 2.5 s; route JS ≤ 400 KiB.
- **A11y:**
  - Targets ≥ 44 px; toggles use `aria-pressed`; decorative art has `alt=""` and `aria-hidden`; contrast 4.5:1.
  - The Caveat ink is `#1A5FA3` on paper.
- **No new art files** except AVIF/WebP derivatives of existing `public/visuals/landing/*` if a size is missing.

## Review Focus

1. A 375 px phone with long TR words in the tag links and note names should never scroll horizontally. Every page task runs `expectNoHorizontalScroll` on mobile.
2. With JavaScript off (crawlers, slow phones), H1, the vitrin line, the answer note and the scene art should all be visible. Every page task runs `expectFirstPaint` with `javaScriptEnabled: false`.
3. With reduced motion, hovering a note must not apply a filter, and Puhu must not bob or blink. Task 2 adds `expectStillUnderReducedMotion` and every page uses it.
4. Keyboard only: the room tabs, demo chips and window tags must be reachable and their `aria-pressed` must flip. Tasks 2, 3 and 5 test it.
5. EN locale (`/en/...`) must render without raw message keys. Task 1's vitest checks key parity, and Task 6's e2e opens every EN route and checks that no `Lp.` key text appears.

---

### Task 0: Branch and spec

**Files:**
- Add: `docs/superpowers/specs/2026-11-21-seo-lp-landing-rooms-design.md`, `docs/superpowers/plans/2026-11-21-seo-lp-landing-rooms.md` (both already in the working tree, untracked).

- [ ] **Step 1:** Run `git status --short`. If anything other than these two docs is modified or untracked, stop and ask the owner to commit or stash it. Do not stash it yourself.
- [ ] **Step 2:** `git switch -c feature/seo-lp-landing-rooms feat/sprint-7-pilot-waitlist-qa`. Expected: the new branch, with `apps/web/src/app/[locale]/pomodoro-timer/page.tsx` present.
- [ ] **Step 3:** Commit both docs: `git commit -m "docs(web): SEO LP landing rooms spec and plan"`.

### Task 1: Copy contract (TR + EN)

**Files:**
- Modify: `apps/web/messages/tr.json`, `apps/web/messages/en.json`. Edit by key with a JSON key-merge script. The files are CRLF with 2-space indent and round-trip exactly; a duplicate key silently loses.
- Test: `apps/web/src/components/seo-lp/seo-lp-copy.spec.ts` (new).

**Interfaces — Produces (keys later tasks read):**
- `pomodoroLp.subhead` (new value), `pomodoroLp.scribble`, `pomodoroLp.hero_note.name`, `pomodoroLp.hero_note.body`
- `studyProgramLp.{yks,tyt,lgs}.subhead` (new values), `studyProgramLp.common.scribble`
- `mistakeNotebookLp.subhead` (new value), `mistakeNotebookLp.scribble`, `mistakeNotebookLp.scene_aria`, `mistakeNotebookLp.ecosystem.who_name`
- `studyAppLp.subhead` (new value), `studyAppLp.scribble`, `studyAppLp.definition_pill`, `studyAppLp.scene.aria`, `studyAppLp.scene.plate` (ICU `"NO {n}"`), `studyAppLp.features.f{1..5}_name`, `studyAppLp.scene.tag_{plan,odak,defter,masa,puhu}`

**TR values:**

| Key | Value |
|---|---|
| `pomodoroLp.subhead` | `Odanı seç, süreni kur, başla! Kayıt yok, bekleme yok: 25 dakika odak, 5 dakika mola, hepsi bu sayfada.` |
| `pomodoroLp.scribble` | `oda senin, süre senin!` |
| `pomodoroLp.hero_note.name` | `ortam sesi` |
| `pomodoroLp.hero_note.body` | `Sahne, kütüphane, kafe, ev ya da sessiz. İstersen sade görünüm: sadece kadran.` |
| `studyProgramLp.yks.subhead` | `Günde kaç saatin var, hedefin ne? Söyle, görevler günlere yerleşsin. Örnek bloklar hemen yanında, bir dokun!` |
| `studyProgramLp.tyt.subhead` | draft, same tone and length: TYT, günlük süre, örnek bloklar |
| `studyProgramLp.lgs.subhead` | draft, same tone and length: LGS, 8. sınıf, dönem, günlük süre |
| `studyProgramLp.common.scribble` | `alanını seç, bloklar gelsin!` |
| `mistakeNotebookLp.subhead` | `Takıldığın soru kaybolmasın! Fotoğrafını çek ya da yaz, defterine koy. Tekrar günü gelince soru yeniden önünde.` |
| `mistakeNotebookLp.scribble` | `bu sefer çözersin!` |
| `mistakeNotebookLp.scene_aria` | `Masada Yanlış Defterim ve kitap okuyan Puhu` |
| `mistakeNotebookLp.ecosystem.who_name` | `kimler için?` |
| `studyAppLp.subhead` | `Planın, odak seansın, yanlış defterin ve çalışma masan tek yerde. Arkadaşların da hemen yanında!` |
| `studyAppLp.scribble` | `bir odaya dokun!` |
| `studyAppLp.definition_pill` | `Kısaca PuhuKoç` |
| `studyAppLp.scene.aria` | `PuhuKoç apartmanı: her odada bir özellik` |
| `studyAppLp.scene.tag_*` | Plan · Odak · Defter · Masa · Puhu |
| `studyAppLp.features.f1..f5_name` | `haftalık plan` · `odak seansı` · `yanlış defteri` · `çalışma masası` · `yapay zekâ koç` |

- EN values are the meaning in the same tone. Program `subhead` labels are drafts; the owner approves them in the PR.
- **Program note:** in `studyProgramLp.common`, `demo_scribble` already holds the plan demo note title, so no key is added for it. The phone layout needs no new key either.

- [ ] **Step 1: Write the failing test** `seo-lp-copy.spec.ts`. It imports `messages/tr.json` and `en.json` and checks three things:
  - `it("keeps the SEO H1s verbatim")`: `tr.pomodoroLp.h1 === "Ücretsiz online pomodoro sayaç"`, `tr.mistakeNotebookLp.h1 === "Yanlış defteri: sorularını kaydet, tekrar zamanı dön"`, `tr.studyAppLp.h1 === "Ders çalışma uygulaması: planın ve çalışma masan bir arada"`, `tr.studyProgramLp.yks.h1 === "YKS çalışma programı: hedefine göre haftanı kur"`.
  - `it("has every new key in TR and EN")`: each Produces key path resolves to a non-empty string in both files.
  - `it("never writes AI in TR vitrin copy")`: no Produces TR value matches `/\bAI\b/`.
- [ ] **Step 2:** `pnpm --filter web exec vitest run src/components/seo-lp/seo-lp-copy.spec.ts`. Expected: FAIL on the missing keys.
- [ ] **Step 3:** Add and change the keys in both JSON files.
- [ ] **Step 4:** Re-run the test, plus `seo-lp-metadata.spec.ts` and `study-program-lp-presets.spec.ts`. Expected: all PASS.
- [ ] **Step 5:** `git commit -m "feat(web): SEO LP vitrin copy in the energetic Puhu voice"`

### Task 2: Shell, paper kit and the Pomodoro page

**Files:**
- Create:
  - `apps/web/src/components/seo-lp/seo-lp-shell.tsx`: server component.
  - `apps/web/src/components/seo-lp/seo-paper.tsx`: server components for the kit.
  - `apps/web/src/components/seo-lp/seo-paper.css`: kit styles, values from the canvas `kit.css`.
  - `apps/web/src/components/seo-lp/seo-flutter-root.tsx`: `"use client"`.
- Modify: `apps/web/src/app/[locale]/pomodoro-timer/page.tsx` and `_components/public-pomodoro-widget.tsx` (CSS hooks only).
- Test: `apps/web/e2e/seo-lp.fixture.ts` (new helpers) and `apps/web/e2e/seo-lp.spec.ts` (new, one `describe` per page).

**Interfaces — Produces:**
- `SeoLpShell({ locale, nonce, jsonLd, faq: { pill, title, items: FaqItem[] }, closing: ReactNode, children })`
  - Renders `<NextIntlClientProvider messages={pickMessages(..., ROUTE_MESSAGE_SCOPES.landing)}>`, the `landing-city-theme landing-day` root, `<LandingNav variant="seo" />`, `<main className="landing-paper seo-lp">`, the children, `PaperFaq`, `closing` and `<LandingFooter />`.
  - The JSON-LD script renders only when `locale === "tr"`, exactly as today.
- `SeoHero({ pill, h1, lead, proof, ctas: ReactNode, scribble, scene: ReactNode, pinned?: ReactNode })`
  - Desktop: two columns (`minmax(0,1fr) minmax(0,1.08fr)`, gap 56 px).
  - Phone (< 768 px): one column, scene after the copy.
  - `pinned` renders after the scene in flow with `margin-top: -72px` on desktop and `-28px` on phone, plus `position: relative; z-index: 2`. It is never absolute, so a tall demo never overflows.
- `PaperNote({ name?, title?, paper?: "lined" | "grid", tape?: string, tilt?: string, pin?: boolean, children })`
  - Renders `<article data-flutter="" className="seo-note ...">`.
  - Default tape is `#9cc7f0`, default tilt `-0.6deg`. `pin` swaps the tape for the red pin.
- `PostitSteps({ steps: { title?: string; body: string }[] })`: an `<ol>` with Caveat numbers. Colors cycle `#fff1a6`, `#ffd9cf`, `#d6ecff`, `#dff3d8` and tilts cycle `-1.4deg`, `1deg`, `-0.6deg`, `1.3deg`.
- `NotebookTable({ head: string[], rows: string[][], markLast?: boolean })`: lined page with a red margin and holes, inside an `overflow-x: auto` box. `markLast` prefixes the last cell with the hand-drawn tick SVG.
- `TagLinks({ links: { href: Href; label: string }[] })`
- `HandScribble({ children })`: Caveat text with the arrow SVG from the canvas.
- `SceneFrame({ className?, label?, children })`: rounded 26 px frame with a 6 px paper ring and shadow. With `label` it renders `role="img" aria-label`.
- `SeoFlutterRoot({ children })`: a div with a ref and `usePaperFlutter(ref)`. Notes get `--flutter-amp: 40`.
- Fixture helpers (`e2e/seo-lp.fixture.ts`):
  - `asVisitor(page)`: the 401 refresh route from `landing.spec.ts`.
  - `expectFirstPaint(page, { path, h1 })`: JS disabled. H1 is visible with exact text, the first `.seo-note` is visible, and `.seo-scene img` is in the viewport on desktop.
  - `expectNoHorizontalScroll(page)`: `scrollWidth <= innerWidth`.
  - `expectFaqJsonLd(page)`: some `script[type="application/ld+json"]` contains `"FAQPage"`.
  - `expectStillUnderReducedMotion(page)`: `emulateMedia({ reducedMotion: "reduce" })`, hover the first `[data-flutter]`, wait 300 ms, then the note's `filter` is `none` and the `.seo-puhu` `animation-name` is `none`.

- [ ] **Step 1: Write failing e2e** `seo-lp.spec.ts › pomodoro`:
  - first paint on `/pomodoro-sayac` with h1 `Ücretsiz online pomodoro sayaç`;
  - no horizontal scroll (mobile);
  - FAQ JSON-LD;
  - reduced motion is still;
  - `#timer` is inside `.seo-hero`;
  - keyboard: Tab to the "Kütüphane" room tab, press Enter, `aria-pressed="true"`.
- [ ] **Step 2:** `pnpm --filter web test:e2e seo-lp.spec.ts -g pomodoro`. Expected: FAIL (no `.seo-hero`).
- [ ] **Step 3:** Implement the kit, the shell and `SeoFlutterRoot`. Port values from the canvas `kit.css` into `seo-paper.css`, scoped under `.seo-lp`. The page frame stays `PAGE_FRAME`.
- [ ] **Step 4:** Rebuild `pomodoro-timer/page.tsx` on the shell:
  - Hero: `scene` is `PublicPomodoroWidget` (unchanged props, still inside its `lf-root` wrapper so `landing-focus.css` applies) inside `SceneFrame`, with `.seo-hero .lf-scene { aspect-ratio: 16 / 11 }`. `pinned` is a grid `PaperNote` with `hero_note`.
  - Below: the answer note (`how.answer_first`, lined); `PostitSteps` from `how.step1..3`; `NotebookTable` for compare with `markLast` and the CTA `location="table"`; a two-note row (`rooms.*` with name `rooms.pill`, and `companion.*` with name `companion.pill` and `TagLinks`); the closing (Puhu sticker `public/visuals/landing/puhu-undecided.webp`, `.seo-puhu` bob, CTAs unchanged).
  - Wrap `main`'s content in `SeoFlutterRoot`.
- [ ] **Step 5:** Re-run the e2e. Expected: PASS on `mobile-*` and `desktop-*`. Run `seo-lp-metadata.spec.ts`: PASS.
- [ ] **Step 6:** `pnpm --filter web lint && pnpm --filter web typecheck`. Expected: clean. Then `git commit -m "feat(web): SEO LP paper kit and pomodoro room hero"`.

### Task 3: Study program template (YKS, TYT, LGS)

**Files:**
- Modify: `apps/web/src/components/seo-lp/study-program-lp-template.tsx` and `plan-demo-widget.tsx` (markup and classes only).
- Test: `apps/web/e2e/seo-lp.spec.ts › study programs`.

**Interfaces — Consumes:** Task 2's `SeoLpShell`, `SeoHero`, `PaperNote`, `PostitSteps`, `NotebookTable`, `TagLinks`, `SceneFrame`, `SeoFlutterRoot` and the fixture helpers.

- [ ] **Step 1: Write failing e2e** for `/yks-calisma-programi`, `/tyt-calisma-programi` and `/lgs-calisma-programi`:
  - first paint (h1 from `tr.json`), no horizontal scroll, FAQ JSON-LD, reduced motion still;
  - `.seo-hero img[src*="room-plan"]` is visible;
  - the plan demo sits inside `.seo-note`;
  - clicking the second field chip sets `aria-pressed="true"` and changes the preview text;
  - LGS has `#veli`;
  - `#ornek` (`#ornek-tyt` on TYT) has 7 rows.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Rebuild the template on the shell:
  - `scene` is `SceneImg src="/visuals/landing/room-plan.webp"` in `SceneFrame`, decorative (`alt=""`, no label: the H1 carries the meaning). Load it with `loading="eager" fetchPriority="high"`.
  - `pinned` is `PlanDemoWidget` reskinned as a grid `PaperNote` with `pin`, titled `demo_scribble`.
  - Chips become paper pills: `on` = ink `#0F2233` with white text. The 7-day preview stacks vertically below 768 px.
  - The save CTA keeps `location="demo"`.
  - Below: answer note, `PostitSteps` (body only, `step1..4`), the sample `NotebookTable` (day cell in Caveat) with the disclaimer and `sample_teaser` in Caveat, the compare `NotebookTable`, the LGS `#veli` note (with the `parent` CTA unchanged), and a bridge note named `bridge_pill` with `TagLinks`.
- [ ] **Step 4:** Re-run the e2e plus `study-program-lp-presets.spec.ts` (unchanged). Expected: PASS.
- [ ] **Step 5:** lint, typecheck, then `git commit -m "feat(web): plan room hero for YKS, TYT and LGS programs"`

### Task 4: Mistake notebook page

**Files:**
- Modify: `apps/web/src/app/[locale]/mistake-notebook/page.tsx` and `_components/notebook-demo-widget.tsx` (markup only).
- Create: `apps/web/src/components/seo-lp/seo-desk-scene.tsx` (server).
- Possibly modify: `apps/web/src/app/[locale]/_components/landing/morning-scene.tsx`, to export the "Yanlış Defterim" notebook and its "Bugün 2 tekrar" note as `DeskMistakeNotebook` if they are inline today. The landing render must stay pixel-identical.
- Test: `apps/web/e2e/seo-lp.spec.ts › mistake notebook`.

**Interfaces:**
- Consumes: `DeskWall`, `DeskWood`, `DeskObjects`, `at` from `desk-room.tsx`; `SceneImg`; the Puhu frames `desk-puhu-{left,right,blink,foot-left,foot-right}.webp`; `landing-morning.css` (imported for the `lm-` stage classes); Task 2's kit.
- Produces: `SeoDeskScene({ label: string, copy: { notebook: string; due: string } })`. The copy comes from the `landing.morning` keys MorningScene already uses for those two labels.

- [ ] **Step 1: Write failing e2e:**
  - first paint (h1 `Yanlış defteri: sorularını kaydet, tekrar zamanı dön`), no horizontal scroll, FAQ JSON-LD, reduced motion still;
  - `.seo-hero [role="img"][aria-label]` is visible;
  - click "Çözdüm" and the solved feedback is visible; click "Takıldım" after reset and the missed feedback is visible;
  - the text `1 / 3` is absent.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Build `SeoDeskScene`:
  - Wall, wood, objects, Puhu reading on the book stack with the blink frame, and the notebook with its due note.
  - No `DeskBoard`, parcel, bubble or `StoryPhone`.
  - The stage stays 1040 × 520.
  - On phone use the landing's 4:3 crop the morning section already defines.
- [ ] **Step 4:** Rebuild the page on the shell:
  - `pinned` is `NotebookDemoWidget` as a taped `PaperNote` (tape `#f7b3a0`).
  - Below: the "what" answer note; `PostitSteps` from `how.step1..3` with titles, then the CTA `location="how"`; the guide as a `NotebookTable`-styled ordered list; then two notes: `ecosystem.*` named `ecosystem.pill` with `TagLinks`, and `who_*` named `ecosystem.who_name`; the closing.
- [ ] **Step 5:** Re-run the e2e, then run `landing.spec.ts`. Expected: PASS; the landing desk test is still green.
- [ ] **Step 6:** lint, typecheck, then `git commit -m "feat(web): morning desk hero for the mistake notebook page"`

### Task 5: Study app page (dawn facade)

**Files:**
- Modify: `apps/web/src/app/[locale]/study-app/page.tsx`.
- Create: `apps/web/src/components/seo-lp/facade-tags.tsx` (`"use client"`) and `apps/web/src/components/seo-lp/seo-facade.css`.
- Test: `apps/web/e2e/seo-lp.spec.ts › study app`.

**Interfaces — Produces:** `FacadeTags({ items: FacadeItem[] })` is a client component. Each `FacadeItem` is `{ id: "puhu" | "defter" | "plan" | "odak" | "masa"; tag: string; name: string; title: string; body: string; plate: string; x: string; y: string; tilt: string; link?: { href: Href; label: string } }`. The page formats `plate` on the server with `t("scene.plate", { n })`. Plate numbers: puhu 1, defter 3, plan 4, odak 5, masa 6.

It renders:
- the tag buttons, absolutely placed over the facade box (`aspect-ratio: 1024 / 1536`), each with `aria-pressed`;
- the pinned `PaperNote` with the selected item (`aria-live="polite"`).

Default selection is `plan`.

Tag positions (percent of the facade box, from the canvas):

| Item | x | y |
|---|---|---|
| puhu | 24.5% | 37% |
| defter | 75.5% | 37% |
| plan | 24.5% | 57.5% |
| odak | 50% | 57.5% |
| masa | 75.5% | 57.5% |

Links:
- plan → `/yks-study-program` (`exams.link_yks`)
- odak → `/pomodoro-timer` (`exams.link_pomodoro`)
- defter → `/mistake-notebook` (`exams.link_notebook`)
- masa and puhu have no link.

- [ ] **Step 1: Write failing e2e:**
  - first paint (h1 `Ders çalışma uygulaması: planın ve çalışma masan bir arada`), no horizontal scroll, FAQ JSON-LD, reduced motion still;
  - the "Plan" tag has `aria-pressed="true"` by default;
  - Tab to "Odak" and press Enter: the note heading becomes `features.f2_title` and a link to `/pomodoro-sayac` appears;
  - `#ozellikler` holds 5 `.seo-note`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Build the scene in `SceneFrame`:
  - The dawn sky is a CSS gradient `#b9d8f3 → #d9e6f2 38% → #ffe0c2 66% → #ffc9a0`, with a sun disc.
  - `SceneImg` for `city-mid.webp` (`mobileSrc` `city-mid-mobile.webp`), behind.
  - `SceneImg` for `city-facade.webp` in front, eager and high priority.
  - `FacadeTags` on top. The phone aspect ratio is 4 / 5 and the facade is 78 % wide, centred.
- [ ] **Step 4:** Rebuild the page on the shell:
  - The `definition` answer note under `definition_pill`.
  - `#ozellikler`: 5 `PaperNote`s with `features.f{i}_name`, `_title` and `_body` (the same items as the tags), then the CTA `location="features"`.
  - `PostitSteps` from `steps.s1..4`.
  - The exams note with `TagLinks`, and the closing.
- [ ] **Step 5:** Re-run the e2e. Expected: PASS on both projects.
- [ ] **Step 6:** lint, typecheck, then `git commit -m "feat(web): dawn facade hero for the study app page"`

### Task 6: Budget, EN pass, docs

**Files:**
- Modify: `apps/web/scripts/check-web-performance-budgets.mjs` (+ `web-performance-budgets.spec.mjs` if it pins the route list).
- Modify: `apps/web/e2e/landing-performance.spec.ts`, `apps/web/e2e/seo-lp.spec.ts`, `docs/features/web-shell.md` and `DESIGN.md` §8.

- [ ] **Step 1: Write failing tests:**
  - `seo-lp.spec.ts › en`: for each EN route (`/en/pomodoro-timer`, `/en/yks-study-program`, `/en/tyt-study-program`, `/en/lgs-study-program`, `/en/mistake-notebook`, `/en/study-app`), the H1 is visible and the body text matches neither `/(pomodoroLp|studyProgramLp|mistakeNotebookLp|studyAppLp)\./` nor `MISSING_MESSAGE`.
  - `landing-performance.spec.ts`: one mobile test on `/pomodoro-sayac` and one on `/ders-calisma-uygulamasi`. Each reads `largest-contentful-paint` through a `PerformanceObserver` and expects < 2500 ms on a production build.
- [ ] **Step 2:** Add a `seoLp` route (`pomodoro-timer`, the heaviest client route) to the budget check at `400 KiB`, next to `landing`.
- [ ] **Step 3:** `pnpm --filter web build`, then `pnpm --filter web test`, `node scripts/check-web-performance-budgets.mjs`, and `pnpm --filter web test:e2e seo-lp.spec.ts landing.spec.ts landing-performance.spec.ts` against the production server. Expected: all PASS, budget under 400 KiB.
- [ ] **Step 4:** Docs:
  - `web-shell.md`: a dated "SEO sayfaları · Landing'in odası" entry naming the shell, the kit and the four scenes.
  - DESIGN.md §8: one paragraph saying SEO pages use the day paper kit with the landing scene per page and no night palette.
- [ ] **Step 5:** `git commit -m "test(web): SEO LP budget, EN pass and docs"`
