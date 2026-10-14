# Mentor QA — 13 October 2026 — Vision board collage editor

## Scope and environment

The collage editor at `/vision-board/board` (`/hedef/pano`) after its redesign: the notebook-style
chrome, pictured frame and texture options, keyboard access, the framed PNG and phone wallpaper,
the share window and sharing to a community room. Timeline:
[`docs/features/coaching.md`](../features/coaching.md), the 2026-10-13 vision board entries.

- **Source:** the uncommitted working tree. The mocked-API runs began on
  `feat/stage-production-readiness` at `7b7d99c9`; by the last run and the real-API pass the
  checkout was on `claude/infallible-hellman-658dad` at `275726c4`, the same uncommitted work on
  top. The PR branch `feat/vision-board-editor` carries the same changes on `master` at
  `cbbb5f7f`; there the workspace typecheck and lint and the editor's own unit specs were run,
  the browser scenarios and the rest of the suite were not (CI runs them).
- **Stack:** the developer's own `next dev` on `localhost:3000`. Every `/v1` call is answered inside
  the test by `mockBoardApi` ([`vision-board-editor.fixture.ts`](../../apps/web/e2e/vision-board-editor.fixture.ts));
  the API on 3001 and the `mentor` database were never reached. **This is evidence about the
  screen, not about the server.**
- **Browser:** Playwright Chromium, two projects: mobile 375×812 and desktop 1280×800. React Strict
  Mode is on (dev server), which is what made VB-06 able to see its bug.
- **Afterwards, by hand:** one pass against the real API (3001, the dev database, R2 storage) with
  the developer's own account, signed in by them. It is the "Real-API pass" section below, and it
  found D4. The isolated QA stack (API 3101 on `mentor_test`, a production web build on 3100) was
  not used: it needs `next build` in this checkout, which would overwrite the `.next` directory
  the running dev server is using.

## Results

| Layer | What ran | Result |
| --- | --- | --- |
| Unit (Vitest, Node) | `pnpm --filter @mentor/web exec vitest run`, the whole web suite | **988/988 passed**, 152 files. The editor's own: `board-export-layout` (frame box, CSS gradient line, wallpaper placement), `board-export` (the weight fallback), `gesture-math` (arrow steps), `use-board-reducer` (now with the load case, D4). |
| Mocked-API browser | [`vision-board-editor.spec.ts`](../../apps/web/e2e/vision-board-editor.spec.ts), 25 scenarios, 2 viewports | **50/50 passed**, 1.8 min. |
| Mutation check | 28 deliberate breaks of the production code, three runs | Every scenario from VB-01 to VB-24 failed for the break aimed at it, on the viewport it applies to, and passed again once the files were restored. Table below. VB-25 needed no break: it was written before its fix and seen failing. |
| Real API, by hand | 11 steps in the app's Browser pane, the developer's own account | 9 passed, 1 blocked by the dev environment's CSP, 1 seen but not clicked. One defect found and fixed (D4). Section below. |
| Static | On the PR branch (`master` + this work): `pnpm typecheck` and `pnpm lint`, the whole workspace | Typecheck 13/13 tasks clean. Lint 0 errors; none of the warnings is in the editor's files. The two `tsc` errors seen earlier (`.next/types/validator.ts`, `invite-lock.spec.ts`) belonged to the stale checkout, not to `master`. |

### Scenarios

Both viewports unless a row says otherwise. "Break" is the mutation that turned the scenario red.

| ID | Scenario | Result | Break that fails it |
| --- | --- | --- | --- |
| VB-01 | The selected tool wears the selected chip (`--play-selected` fill, `--play-selected-ink` label), not `--color-btn` black | PASS | Rail label back to `--color-btn-label` |
| VB-02 | Desktop: the board steps aside for the open panel and takes the room back when it shuts. Phone: the board comes first and the sheet rises under it. Puhu's welcome shows on an untouched board and goes with the first thing added | PASS | Desktop: the stage keeps one padding. Phone: the sheet made 70dvh tall |
| VB-03 | "Çerçevesiz" is a tile of its own. An item takes focus, Shift+Arrow moves it, one undo takes the move back | PASS | The arrow patches nothing |
| VB-04 | The share window's picture is the framed board, 3584×2504, saved as `hedef-panom.png`; the wallpaper is 1170×2532, saved as `hedef-panom-duvar-kagidi.png`. With no forum answering, the community row is not offered | PASS | Wood moulding share 0.022 → 0.03 |
| VB-05 | Two rooms: the post waits for a room and a note; the board goes up as a JPEG and the post reaches the chosen room with the note and the attachment; the window gives way to a toast with "Gönderiyi gör" | PASS | The post sent with no attachment |
| VB-06 | Tapping the open category shuts the panel, tapping again opens it, Escape shuts it | PASS | The toggle always opens |
| VB-07 | With the share window open, Delete does not remove the item selected behind it; on the board it does | PASS | `dialog` taken out of the shortcut guard |
| VB-08 | Selecting an item opens its panel on desktop and not on a phone. The selection's toolbar sits above the board on desktop, between the board and the dock on a phone | PASS | Phone: selecting always opens the panel; the toolbar row loses `max-lg:order-last`. Desktop: selecting no longer switches the panel |
| VB-09 | The frame is 4.8% of the framed width on each side, whatever the window's width | PASS | Frame thickness doubled; moulding share changed |
| VB-10 | A texture tile changes the board's background (cork → grid) | PASS | The panel's background setter does nothing |
| VB-11 | Picking a font changes the selected text's font (Poppins → Caveat) | PASS | The font pill does nothing |
| VB-12 | Tab moves from one item to the next, never onto a handle. Enter opens a text for typing and the typed words replace it | PASS | Handles made tab stops; the Enter handler returns early |
| VB-13 | A paused edit is saved by itself: "Kaydedilmedi", one PUT carrying the moved item (x 550 → 554), then "Kaydedildi" | PASS | Autosave delay 2 s → 10 min; the arrow patches nothing |
| VB-14 | "Panelimde göster" PUTs `status: PUBLISHED`, toasts, and leaves a disabled "Kaydet" in its place | PASS | The publish sends `DRAFT` |
| VB-15 | A chosen file is uploaded (`image/png`) and lands on the board; the welcome goes | PASS | Every file treated as unsupported |
| VB-16 | The welcome's "Şablonla başla" opens the Şablon panel | PASS | The link does nothing |
| VB-17 | Where files can be shared, "Paylaş" hands `hedef-panom.png` (`image/png`) to the system share call; "İndir" stays, "Görseli kopyala" is not offered | PASS | The share probe always says no |
| VB-18 | "Görseli kopyala" writes one `image/png` clipboard item | PASS | The copy writes nothing |
| VB-19 | A photo on the board is in the exported picture (a magenta photo, sampled at its middle through the frame's inset) | PASS | The photo is not drawn |
| VB-20 | A photo that will not load does not stop the export; its place is the placeholder grey | PASS | The placeholder painted black |
| VB-21 | Being only in a question room, the community step says there is no room to post to and links to Topluluk | PASS | The empty state never renders |
| VB-22 | When the server refuses the post, its own message stays in the window, the note is kept, the button comes back, nothing is recorded as posted | PASS | The generic message shown instead |
| VB-23 | With exactly one eligible room it is already chosen; the note alone enables "Paylaş" | PASS | No room preselected |
| VB-24 | In the dark theme the wall and the rail take their dark tokens (`#242833`, `#1A1D24`); the board's cork stays cork | PASS | The wall hard-coded to its light value |
| VB-25 | A saved board that has just opened has nothing to undo: "Geri al" is disabled, Ctrl+Z leaves the board as it is and nothing is marked unsaved | PASS | Seen failing before the fix (the load dispatched `replace`) |

## Real-API pass

The same screen with nothing mocked: `next dev` on 3000, the API on 3001, the dev database and R2
storage, in the app's Browser pane (phone width, plus one 1280×800 emulation) on the developer's
own account. The board it started from: two goal texts, wood frame, `#faf7f2`, `PUBLISHED`.

| # | Step | Result |
| --- | --- | --- |
| R-01 | The editor opens the saved board | First run: "Geri al" was enabled on a board nobody had touched. That is D4. After the fix: undo, redo and "Kaydet" are all disabled |
| R-02 | Arrow right, wait; arrow left, wait; reload | PASS. Two `PUT /v1/coaching/vision/board` → 200, and the reloaded board equals the first one |
| R-03 | Upload a photo | PASS. Upload URL 201, the file `PUT /v1/storage/uploads/<token>` 204, the photo on the board, board PUT 200 |
| R-04 | Reload with the photo on the board | **BLOCKED (environment).** The photo's R2 host is not in `img-src`, so the editor shows a broken image. E1 below |
| R-05 | Open the share window | PASS. A 3584×2504 preview, the community row offered. The blocked photo is drawn as the placeholder grey, which is VB-20's path reached for a different reason |
| R-06 | Delete the test photo, wait | PASS. Board PUT 200, two items again |
| R-07 | "Toplulukta paylaş": pick a room, write a note, post | PASS. The step lists the account's real rooms. A 140,639-byte JPEG (3584×2504) uploaded, and the post landed in the chosen room with the note and the attachment |
| R-08 | The toast and "Gönderiyi gör" | Toast seen ("Panon toplulukta"). **Not clicked:** it had gone before the automation reached it. The post's page, opened by its address, shows the note; its picture is there and blocked by the same CSP |
| R-09 | The editor at 1280×800 | PASS. Frame 4.8% of the framed width, undo disabled |
| R-10 | `/panel`, the "Hedefin" card | PASS. The published board is in the card with its frame, 4.79% a side |
| R-11 | `GET /v1/coaching/vision` at the end | PASS. The board equals the one the pass started from |

Left behind in the dev environment: one community post in "KPSS Genel Sohbet" (thread
`0868e7bc-c7ca-4b1a-9279-5f6fd88bd9fb`, note "QA testi: vizyon panosu paylaşımı.") and the uploaded
test photo's object in storage, which no board points to any more.

## Findings

Four defects in all. Three were found and fixed while the feature was being built, the fourth by
the real-API pass, and each now has a scenario that fails without its fix:

| # | Defect | Scenario |
| --- | --- | --- |
| D1 | `BoardFrame` sized its moulding against the window, not the board: a size container's own `cqw` lengths resolve against the container above it. On a 1280 px desktop that works out to about 6.4% a side instead of 4.8%, and the export could never have matched it | VB-09 |
| D2 | The rail's "tap the open category to shut it" lived inside a state updater; React Strict Mode ran it twice and it cancelled itself, so in development the panel would not shut | VB-06 |
| D3 | The editor's window-level shortcuts would have reached through the share window: Delete pressed in the dialog removed the item selected behind it | VB-07 |
| D4 | Opening a saved board counted as an edit. The server's board arrived through `replace`, which pushed the editor's empty placeholder onto the undo stack: one Ctrl+Z on a freshly opened board brought the placeholder back, marked dirty, and two seconds later autosave would have written it over the real board. Older than this redesign, and data loss. The load now has its own `load` action, which starts the history over | VB-25, and "loading a board leaves nothing to undo and nothing to save" in `use-board-reducer.spec.ts` |

Not defects of the editor, from the real-API pass:

- **E1, the dev environment's CSP hides every stored picture.** `img-src` is the API's origin plus
  `WEB_CSP_STORAGE_ORIGINS`, and that variable is empty here, so the R2 hosts (the signed
  `…r2.cloudflarestorage.com` one and the public `pub-….r2.dev` one) are refused: a board photo
  after a reload, the avatar, a forum attachment. Nothing was changed; it is a setting for whoever
  owns the environment. Until it is set, an export made here carries the placeholder grey in place
  of each photo.
- **Two rooms with one name.** The dev data holds two rooms called "KPSS Genel Sohbet" and the
  picker shows titles only, so they cannot be told apart. Whether real data can hold two rooms
  with one title was not checked.
- **"Gönderiyi gör" lives only in the toast.** Once the toast is gone there is no link to the post
  from the editor. A person has the toast's few seconds; nothing here measured whether that is
  enough.
- The browser's request list marks the 204 upload `PUT` as aborted while the upload itself
  succeeds (the photo and the attachment were both stored). Not looked into further.

Two things the check itself turned up:

- **VB-02's phone half is a coarse check.** It did not notice the selection toolbar's row moving
  back above the board, because 375×812 leaves that much slack between the board and the sheet. The
  row's position is VB-08's job, and VB-08 does catch it. VB-02 fails when the sheet itself grows.
- **The weight fallback had no test.** A board heavier than the forum's 5 MB cap is redrawn at half
  the pixels; that branch could not be reached in a browser test without a 5 MB board. It moved to
  `renderBoardWithinBytes` in `board-export.ts` and has a unit test, written first and seen failing.

One observation, still not verified against a real storage host (E1 stopped the photo before CORS
could matter): `BoardExportTaintedError`, and the "Görseller indirmeye kapalı…" message behind it,
look unreachable. Photos are loaded with `crossOrigin="anonymous"`, so a photo served without CORS
headers fails to load and becomes the placeholder (VB-20's path) instead of tainting the canvas.

## Not covered

- **A stored photo in an exported picture.** The one thing the real-API pass could not reach: with
  the storage hosts blocked (E1), no real photo was ever drawn into a PNG, a wallpaper or a
  community post. It needs `WEB_CSP_STORAGE_ORIGINS` set and the bucket answering with CORS
  headers; if the bucket does not, every photo exports as the placeholder and nothing says so.
- **Also not reached with the real API:** moderation of the post, clicking "Gönderiyi gör", a
  refused post, a room list with no eligible room, the draft-to-published step (the account's
  board was already published).
- **The platform's share sheet and clipboard.** VB-17 and VB-18 stand a function where the
  platform would be; they prove what the editor hands over, not that a phone shares it.
- **Other browsers.** Chromium only. Safari is the one that matters: the frame depends on
  container query units and the export on canvas `letterSpacing`.
- **A production build.** Everything ran on the dev server.
- **Touch.** Dragging, resizing and rotating were driven as a mouse.
- **Limits and refusals of the editor itself:** 20 photos, 30 texts, a 5 MB photo, an unsupported
  file type.
- **What a screen reader says**, beyond the roles and names the scenarios select by.
- **Parts of the editor this work did not change:** templates, stickers, photo frames, the colour
  panel, layer order, duplicate. `use-board-reducer.spec.ts` covers the document side of some.

## Re-running

```bash
pnpm --filter @mentor/web exec vitest run board-export gesture-math use-board-reducer
```

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter @mentor/web exec playwright test vision-board-editor
```

The second needs `pnpm --filter @mentor/web dev` running. Without `PLAYWRIGHT_BASE_URL` Playwright
starts `next start` on 3100, which needs a production build first.

To repeat the mutation check, apply a row's break by hand, run that scenario with `-g "VB-NN"`, see
it fail, and undo the break. A scenario that still passes is the finding.

The real-API pass has no script. It needs a signed-in session in the Browser pane, it changes that
account's board through autosave, and it leaves a real post behind: say so before running it.
