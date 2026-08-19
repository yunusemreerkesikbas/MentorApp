# Achievement System — V1 Design

> Status: approved on 2026-08-18
> Scope: permanent achievement collection; dynamic identity badges remain a separate concept

## Product decision

V1 ships a fixed catalog of 12 permanent achievements. An achievement is earned once, keeps its
original award timestamp, and remains in the user's collection. Dynamic identity badges such as
`New Companion` or `Rhythm Keeper` may continue to reflect current behaviour, but they are not
stored or presented as permanent achievements.

The system celebrates effort, reflection, recovery, and mutual support. It must not rank exam
results, shame interrupted streaks, or expose private mood and AI-coach signals on public profiles.

## Locked V1 catalog

| Stable ID | Turkish title | Trigger intent |
|---|---|---|
| `first_step` | İlk Adım | Complete the first focus session |
| `route_drawn` | Rotanı Çizdin | Create the first study plan |
| `dream_space_created` | Hayaline Yer Açtın | Create the first vision board |
| `rhythm_found` | Ritmi Yakaladın | Reach the initial streak milestone |
| `rhythm_kept` | Ritmi Korudun | Reach the sustained streak milestone |
| `returned_to_path` | Kaldığın Yerden | Complete a study action after a meaningful break |
| `route_renewed` | Rotayı Yeniledin | Adapt the plan after disruption |
| `starting_point_set` | Başlangıç Noktan | Record the first mock exam |
| `mistake_revisited` | Bir Daha Baktın | Revisit a recorded mistake |
| `week_reflected` | Haftana Kulak Verdin | Complete the first weekly reflection |
| `first_hello` | İlk Merhaba | Make the first community contribution |
| `helped_someone` | Birine İyi Geldin | Receive a verified helpful-contribution signal |

Exact numeric thresholds are implementation configuration, not part of the user-facing title.
Stable IDs must never be renamed after release.

`self_check_in` / **Kendine Kulak Verdin** is deferred to V1.1 because it requires an explicit
private/public visibility policy.

## Ownership and management

V1 is code-owned rather than admin-authored:

- The `community` bounded context owns achievement evaluation and persisted awards.
- Source modules publish domain events; they do not write achievement records directly.
- Backend code owns stable IDs, rule evaluators, versions, categories, and asset keys.
- Backend locale resources own user-facing achievement titles and descriptions.
- Postgres stores the user's immutable award record, including `earnedAt` and rule version.
- Awards are idempotent: replaying an event must not create a duplicate.
- The web client displays API data and never evaluates earning rules.

V1 does not include an admin rule builder or achievement-definition CRUD. A later admin slice may
control activation, ordering, localized editorial copy, seasonal dates, and approved asset
replacement. Rule semantics remain versioned code because changing them can alter historical
awards.

## Event and data flow

1. An owning module completes a domain action, such as `FocusSessionCompleted`.
2. It publishes a domain event after the source transaction succeeds.
3. The community achievement listener evaluates only rules relevant to that event.
4. The repository inserts the award with a unique `(org_id, user_id, achievement_id)` constraint.
5. A duplicate/replayed event is treated as an idempotent no-op.
6. The achievement API returns the complete catalog with locked, in-progress, and earned states.
7. A newly earned achievement may trigger one event-driven, one-shot celebration.

If evaluation fails, the source action remains successful. The listener records the failure for
retry/operations; the user must never lose a completed study action because achievement decoration
failed.

## Visual system

V1 uses premium soft-3D rendered illustrations, not runtime WebGL models. Production masters may be
created with an image-generation or offline 3D workflow, but the web and future Expo clients consume
optimized transparent WebP/PNG assets. This preserves performance, accessibility, and cross-client
parity while keeping a premium dimensional look.

All 12 achievements use Puhu as the single protagonist. The canonical character reference is:

`apps/web/public/mascot/puhu/puhu-default.png`

Every achievement is a unique narrative scene rather than a simple accessory pasted onto the same
pose. The following Puhu traits are locked across all art: white rounded fluffy body, large dark eyes
with consistent highlights, round blue glasses, pale-blue feather tufts, small orange beak, blue
chest heart, pastel blue rim light, and a gentle encouraging expression. Pose, props, lighting,
environmental symbols, and badge-frame colour may vary.

The collection borrows Duolingo's character-led storytelling principle but does not introduce a new
supporting cast in V1. It remains Mentor-owned Puhu art, not a Duolingo imitation.

## Interaction and accessibility

- Tap/click opens an achievement detail surface with title, reason, progress or earned date.
- Gesture-only rotation is forbidden; all actions require a visible keyboard/touch alternative.
- Celebration is one-shot and no longer than the DESIGN.md moment-motion budget.
- `prefers-reduced-motion` keeps the reward content and removes movement.
- Locked state uses iconography and copy in addition to desaturation; colour is not the only signal.
- Art has stable reserved dimensions and an accessible text equivalent.

## Verification targets

- Pure rule tests cover every threshold boundary and rule version.
- Idempotency tests prove event replay creates one award.
- Integration tests cover representative coaching, analysis, and community events.
- API tests cover locked, progress, earned, and private visibility states.
- Web tests cover keyboard access, reduced motion, missing-asset fallback, and 375 px layout.
- Asset checks enforce agreed dimensions, transparency, format, and file-size budgets.

## Explicitly out of scope for V1

- Runtime Blender/GLB/WebGL badge rotation
- Admin-authored arbitrary achievement rules
- New supporting characters beyond Puhu
- Coin rewards tied to achievements
- Exam score or result-ranking achievements
- Public display of mood or raw AI-coach-derived achievements
