# Mobile Plan tab, stop C (Puhu'yla planla) — design

Date: 2026-11-14 · Branch: `feature/APP-142-mobile-core-qa` · App: `apps/mobile` (Expo SDK 58)
Reference: the web plan at phone width, `apps/web/src/app/[locale]/(app)/plan/_components/`:
`plan-coach-adaptation-action.tsx` (orchestrates), `use-plan-coin-flow.ts`,
`use-plan-coach-generation.ts`, `use-plan-coach-preview.tsx`, `plan-coin-sheet.tsx`,
`plan-coin-view.ts`, `plan-coach-adaptation-brief*.tsx|ts`, `plan-coach-adaptation-stage.tsx`,
`plan-coach-stage-{notes,sky,scene}.ts(x)`, `plan-coach-stage.css`,
`plan-coach-adaptation-preview.tsx`, plus `apps/web/src/lib/{plan-previews,coach,plan-coach-adaptation-utils}.ts`.
Design notes: DESIGN.md §6.1 (Açma seçimi), §9.1 ("Şehrin üstünde");
`docs/plans/2026-11-03-coin-unlock-choice-design.md` (Round 2: sheet before wizard).

## Intent

The student-core release reaches web parity screen by screen. Stop A (Liste) is committed
(aedfa1e6). Stop C brings the web's "Puhu'yla planla" to the phone. The student asks Puhu to build
the coming week, answers four short questions, and watches Puhu work over the night city. Then they
pick which of the suggested moves and new tasks to keep. Stop B (Timeline + Takvim) follows. The
owner will not ship mobile until all development is done, so interim states are never seen by users.

## Owner decisions (2026-11-14)

| Topic | Decision |
|---|---|
| Fidelity | Web at phone width is the reference: all four parts (access, wizard, stage, preview), with the stage's video and paper notes |
| Panel "Bugünü hafiflet" | **A**: a Premium student (subscribed on the web) gets the web's MOOD lighten flow; a free student lands on the Plan tab as today |
| Approach | **1**: port the web's structure; move its pure logic to `@mentor/core`, and the web re-exports it |
| Server's Premium wording | **B**: the phone shows its own neutral line (goal 11) |

Standing rules that apply: the phone never sells or teases Premium (no in-app purchase yet), so the
Premium row of the choice sheet never appears. Puhu's voice is energetic. The AI is "yapay zekâ" in Turkish.

## Who sees what on tap

| Student | Tapping "Puhu'yla planla" opens |
|---|---|
| Premium (web subscription), or `plan.ai` free taste on, allowance left | The wizard at once (`mode: INCLUDED`) |
| Free, enough Coin | Choice sheet → confirm block (balance → after) → wizard whose last button says "{cost} Coin" |
| Free, Coin short | Choice sheet: Coin row with `{balance}/{cost}` progress and "{missing} Coin eksik"; no button, no Premium row |
| Free, allowance used | Choice sheet: limit title, empty pips, "next available today/tomorrow at HH:mm" |
| AI switched off or budget hit | Sheet: "şu an olmuyor" row with "Tekrar dene" |
| Coin path off (`mode: NONE`, `PAYMENT_PREMIUM_REQUIRED`) | Sheet with the phone's own neutral line (goal 11), never the server's "Premium'a açık" |
| Any, with a draft saved earlier | "Kayıtlı taslağımı aç" beside the button (once the access has been read) |

## Goals

1. **Entry row**, above the week card (the web's header row): a ghost button with a sparkle glyph,
   "Puhu'yla planla" (`coach_adaptation_cta`), busy while the access read runs. "Kayıtlı taslağımı
   aç" (`coin_preview.saved`) sits next to it when the last access read carried a
   `latestRequestId`. The row shows only when `availability.aiCoach` is on.
2. **Access** (`open({source:"PLAN"})`): `GET /v1/coach/plan-previews/access` →
   `planAccessView(offer, false)`:
   - `wizard` → open the wizard on the included path;
   - `choice` / `retry` / `notice` → the choice sheet;
   - `paywall` → the choice sheet in its notice form, with the neutral line of goal 11 (the phone
     has no paywall and never shows the server's Premium wording);
   - off the Coin path, when the access cannot generate but a draft exists → read the saved draft
     (goal 8).
   A failed read shows the error toast.
3. **Choice sheet** (the web's `PlanCoinSheet` in a bottom sheet, title `coin_preview.title`):
   - **Choice rows, with this content:**
     - Coin row: title, balance aside, allowance pips or progress line, caption, and a "{cost} Coin" button that arms the confirm block.
     - Confirm block: from → to, note, confirm and cancel.
     - Retry row; notice text; `saved_detail` footnote; "Kayıtlı taslağımı aç" link.
   - **Shared row components.** The rows are the same ones the mobile recap card draws today. Move its private `Row`, `Caption`, `Pips` and the confirm block into `components/unlock/` and use them from both places.
   - **Behaviour:**
     - Confirming opens the wizard with the paid cost.
     - A pending regenerate goes straight to generation.
     - A `resume` draft pays for the draft and opens it.
   - **Errors after a Coin request.** `AI_PLAN_PRICE_CHANGED`, `INSUFFICIENT_COIN` or `AI_PLAN_COIN_LIMIT_REACHED` come back as the sheet, re-armed with the error, after the offer is re-read.
4. **Wizard** (the web's `PlanCoachAdaptationBrief`):
   - **Container:** a full-screen modal built on the onboarding `OnboardingStepShell`.
   - **Steps:** days, minutes, subjects, note. The subjects step is left out when the exam taxonomy is empty.
   - **Each step shows:**
     - progress `{index+1}/{steps+1}`;
     - Back on every step (on the first it closes the wizard);
     - "Atla" (skip), which clears that step's answer;
     - a Puhu bubble with the step title, and on the first step the coach's `groundingLine`, else the known-facts line;
     - a pinned button: "Devam" on every step but the last, then `coach_adaptation_generate` or "{cost} Coin" on the Coin path.
   - **Prefill, in this order:**
     1. Days: the next 7 days from today, rhythm weekdays pre-picked and badged.
     2. Minutes: the profile goal first, else the coach's suggestion. Choices are 60/120/240/360 plus a custom entry within the validation bounds.
     3. Subjects: the taxonomy subjects, seeded from the coach's focus subjects (or this week's pending subjects) and marked "Puhu önerdi".
     4. Note: up to 500 characters, with a counter.
   - **Brief read:** the coach's brief is read when the wizard opens (`/v1/coach/plan-adaptation/brief` on the included path, `/v1/coach/plan-previews/brief` on the Coin path). It fills in when it lands; a failed read keeps today's defaults.
   - **Submit:** the payload is validated with `coachPlanAdaptationSchema`. The wizard stays open under the stage, so a failed request returns to it with every answer and the error above the button.
5. **Stage, "Şehrin üstünde"** (the web's `PlanCoachAdaptationStage`): a full-screen modal over the wizard, always in its own night palette (it never follows the theme).
   - **Background:**
     - the sky gradient `#0d0e25` 0–50% → `#132552` 74% → `#1b3563`, with a few faint stars;
     - the landing's three city layers along the bottom (`visuals/landing/city-{far,mid,front}.webp`);
     - a bottom shade.
   - **Puhu:** the `puhu-hero-magic-loop.mp4` loop in a soft round mask: a radial fade into the sky colour, with the video's ground `#08113A`. The poster `puhu-hero-magic.webp` shows under reduced motion or on a playback error.
   - **Title and sub line:**
     - Title `coach_adaptation_stage_title`, 28/34, weight 900.
     - Sub line, two lines tall so Puhu never jumps: the brief's `groundingLine`, or `stage_sub` when tasks are pending.
     - After 12 s the sub line switches to `stage_slow`, in lamp yellow.
   - **Paper notes:**
     - Taken from `brief.evidence`, at most 6, in its order; with no brief there are no notes.
     - One note every 3.6 s, cycling, on a pile at most two sheets deep.
     - Each note has a tape strip, the evidence-type glyph with its label in Caveat, and the summary on up to 4 lines.
   - **Caption:** days · minutes · subjects from the request.
   - **Progress bar:** carries on from the wizard's bar and fills on arrival.
   - **"Vazgeç" (and Android back):** abandons the wait in the UI only. A Coin request keeps running on the server and lands as a saved draft.
   - **On arrival:** the ready title shows, the pile leaves, and 1.2 s later the preview opens. With reduced motion the notes do not travel and the preview opens at once.
   - **MOOD source:** uses the `_lighten` titles and the pending-count caption.
6. **Preview** (the web's `PlanCoachAdaptationPreview` in the shared form sheet), titled `coach_adaptation_preview_title`.
   - **Content, top to bottom:**
     - the Puhu companion bubble with `coachNote` or `groundingLine`, and the grounding line under it when both exist;
     - `message`;
     - a collapsible "Neye dayandı" evidence list;
     - change cards grouped by date ("Pazartesi, 16 Kasım"). Each card has a checkbox (all ticked at first), the title, "{n} dk" for an ADD, "from → to" for a MOVE, the subject, and the reason;
     - the selected count.
   - **Pinned button:** "Seçilenleri uygula", or "Kapat" for `NO_CHANGE`. With none selected the sheet shows `select_required`.
   - **Apply:** `POST /v1/plan-tasks/adapt`.
     - On 409 the plan reloads, the error shows, and "Yeniden oluştur" appears. On the Coin path it goes back through the sheet with the answers pending; otherwise it regenerates directly.
     - On success: the toast `success_title` / `success_message` (moves and adds), then the Plan refresh used by stop A (`refreshAfterChange`).
7. **Generation** (the web's `usePlanCoachGeneration`):
   - **Request by path:**
     - Included path: `POST /v1/coach/plan-adaptation`.
     - Coin path: `POST /v1/coach/plan-previews` (`Idempotency-Key` = client UUID, `expectedCost`).
     - Resume: `POST /v1/coach/plan-previews/:id/confirm` (`Idempotency-Key` = id).
   - **Run counter:** a late answer after "Vazgeç" is dropped.
   - **After a Coin spend:** refresh the economy balance (the nav Coin pill) and re-read the offer.
   - **Premium refusal:** `PAYMENT_PREMIUM_REQUIRED` (a stale entitlement) shows the neutral line of goal 11 as an error toast, never a paywall and never the server's message.
8. **Saved draft:** `GET /v1/coach/plan-previews/:id`.
   - When it holds a preview, close the sheet and open the preview.
   - When its state is `GENERATED` (Coin not yet taken), show the sheet in its resume form ("pay and open").
9. **Panel "Bugünü hafiflet" (decision A):**
   - **A student the web would let through** (`isPremiumFeatureAvailable(subscriptionView, "plan.ai")`: Premium, or the `plan.ai` free taste; `useIsPremium` alone would miss the free taste): the button routes to `/plan` with `coach=adapt&source=mood`. The Plan screen consumes the params once, clears them, and runs the MOOD flow: no Coin, no wizard; straight to the stage, then the preview.
   - **Free student:** `/plan` exactly as today.
10. **Copy:** the web's `plan.coach_adaptation_*`, `plan.coach_adaptation_evidence.*` and `plan.coin_preview.*` strings are copied verbatim into the mobile `tr.ts` and `en.ts`. The Premium-only strings (`premium*`, `trial`) are left out because nothing shows them. The mobile formatter has no ICU plural/select, so strings that use it (`limit_title`, `next_available`, the English `stage_days`/`stage_subjects` and similar) are split into plain variants, as the recap stop did.
11. **Neutral line for `PAYMENT_PREMIUM_REQUIRED` (owner decision B, 2026-11-14):** the phone shows its own line instead of the server's "Bu özellik Premium'a açık.". TR: "Puhu'yla planlama şu an telefonda açık değil." EN: "Planning with Puhu isn't open on the phone right now." It applies to the sheet's notice form and the stale-entitlement toast. The weekly recap card shows the server's text in the same situation; aligning it is outside this stop.

## Shared logic moved to `@mentor/core` (web re-exports)

Each moved file keeps its web spec, which moves with it. Exact module names are the builder's call.

- **Access:** `planAccessView`, `clockSuffix`, `COIN_SHEET_ERRORS` (from `plan-coin-view.ts`).
- **Brief:** `summarizePendingWeek`, `seedBriefSubjects`, `isMinuteEntry`, `planWindowDays`/`planWindowToday`,
  `formatKnownBrief`, `PLAN_ADAPTATION_NOTE_MAX`, `PLAN_ADAPTATION_MINUTE_CHOICES`, `PlanAdaptationKnownWeek`
  (from `plan-coach-adaptation-brief-note.ts`).
- **Stage:** `STAGE_TIMING`, `STAGE_MAX_NOTES`, `stageNotes`, `stageNoteIndex`, `stagePileDepth`
  (from `plan-coach-stage-scene.ts`).
- **Preview rows:** `flattenPlanAdaptationChanges`, `selectedPlanAdaptationChanges`, `parsePlanAdaptationQuery`
  (from `lib/plan-coach-adaptation-utils.ts`).
- **Entitlement:** `isPremiumFeatureAvailable` (from `apps/web/src/lib/premium-feature.ts`), for goal 9.

The brief helpers and `parsePlanAdaptationQuery` need `@mentor/validation`, and core depends only on
`@mentor/types` today. Validation depends on config and types, not core, so adding
`@mentor/validation` to core's dependencies makes no cycle. This is my call; the alternative of
passing the bounds in as arguments makes every caller repeat them.

Screen-side state (the coin flow, the generation run, the preview opener) stays in the app. React
hooks do not belong in core, and the web's hooks use web-only toasts and sheets.

## Non-goals

- Premium paywall, trial, or any Premium row or mention made by the phone itself.
- "Coin nasıl kazanılır" link (the mobile recap card leaves it out too).
- The session-end "planı hafiflet" (`source: SESSION`): the phone has no entry point.
- Analytics events (`coach_plan_adaptation_*`): the phone has no analytics client yet.
- The Liste/Timeline/Takvim switcher (stop B). A coach's own plan view.

## Anti-goals

- **Charging Coin twice:** for a double tap, a retry, or a back press during the stage. Guard with refs and idempotency keys, as the web does.
- **Losing the wizard's answers:** when a request fails.
- **Figures the coach did not read:** the stage never shows a made-up number. Notes are evidence only, and the bar stays one step short until the answer lands.
- **A Premium tease:** anywhere on mobile.

## Constraints

- Android at density 2.625 (stop A gotchas):
  - single-line labels need `numberOfLines`;
  - rounded fills that change need a `key` remount;
  - guard double taps with refs.
- Video: use `expo-video`, as the chest scene does. Masks: `react-native-svg` gradients (no CSS mask on native). Motion: Reanimated 4, honouring reduced motion.
- **Layering (my call, from the builder check).** The wizard and the stage live in one full-screen host `Modal`, the stage as a layer over the wizard, so "the wizard stays under the stage" never needs two modals at once. The choice sheet and the preview stay on the existing `BottomSheet`/`FormSheet`. A hand-off between the host and a sheet opens the next layer only after the previous one has closed: iOS drops a modal opened while another is still closing. Android is the verification target, as for every earlier stop; iOS stays unverified.
- Assets are imported from `apps/web/public` the way `lib/art.ts` does. Caveat is already loaded (`Caveat_700Bold`).
- After a core change, build core before the mobile and web tests.
- Gate: `pnpm --filter @mentor/core test`, `@mentor/web test`, `@mentor/mobile test`, mobile typecheck and lint.
- **QA cost:** every generation is a real yapay zekâ call. The Coin path needs a QA account with Coin (dev DB grant); the MOOD path needs a Premium QA account (the STAFF role in the dev DB). The access endpoint's daily limit applies.
- Do not touch other sessions' uncommitted files. The web changes here are only the moved helpers and their re-exports.

## Approaches considered

1. **Port the web structure, pure logic in core (chosen).** One controller on the Plan screen; the sheet, wizard, stage and preview are full-screen modals over it. The behaviour matches the web (the wizard stays under the stage), and the Coin rules live in one place. It touches web files (re-exports) and adds a core dependency.
2. **One Expo Router modal route per step.** The back button comes for free, but the preview object and the Coin offer must cross routes through a store. A back press on the stage closes a screen whose Coin request is still running. Returning to the wizard with answers gets harder.
3. **Copy the logic into mobile.** Fewer files, but two copies drift (a Coin rule changes in one), and it breaks the "core logic, web re-exports" rule.

## Left to the builder

- Module and component file names. Splitting files so none passes ~300 lines.
- The sparkle glyph (Solar has no exact Sparkles; pick the closest).
- Exact sizes at 390 dp, matched against web captures taken at 390×844.
- The evidence-type glyph map (Solar equivalents of the web's lucide set; unknown types get the sparkle).
- How the stage's video mask is drawn, as long as the clip shows no edge against the sky.
